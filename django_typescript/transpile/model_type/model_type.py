from typing import List
from collections import namedtuple

from django.db import models

from django_typescript.core import types, endpoints
from django_typescript.core.field_info import FieldInfo
from django_typescript.model_types import ModelType
from django_typescript.core.utils.typescript_template import TypeScriptTemplate
from django_typescript.transpile.field_type import FieldTypeTranspiler
from django_typescript.transpile import templates
from django_typescript.transpile.common import render_type_declaration
from django_typescript.transpile.common import method_sig_interface
from django_typescript.transpile.model_type.common import (model_prefetch_type_name,
                                                           model_lookups_name,
                                                           model_queryset_name)
from django_typescript.transpile.model_type.fields import (ConcreteFieldTranspiler,
                                                           ForwardRelFieldTranspiler,
                                                           ReverseRelFieldTranspiler)
from django_typescript.transpile.model_type.fields.many_to_many_field import ManyToManyFieldTranspiler


# =================================
# Constants
# ---------------------------------

QUERYSET_SUFFIX = 'QuerySet'
QUERYSET_LOOKUPS_SUFFIX = QUERYSET_SUFFIX + 'Lookups'
FOREIGN_KEY_DECORATOR_NAME = 'foreignKeyField'
TYPESCRIPT_THIS_PK_REF = '${this.pk()}'
TYPESCRIPT_ARG_PK_REF = '${primaryKey}'
FIELDS_INTERFACE_SUFFIX = 'Fields'
PREFETCH_KEY_TYPE_SUFFIX = 'PrefetchKey'


# =================================
# Utils
# ---------------------------------

def model_field_interface_name(model_cls: types.ModelClass):
    return model_cls.__name__ + FIELDS_INTERFACE_SUFFIX


ModelMethod = namedtuple('ModelMethod', ['name', 'sig_interface', 'url'])
ReverseRelation = namedtuple('ReverseRelation', ['name', 'lookups_type', 'queryset_name', 'lookup_key'])
PropertyField = namedtuple('PropertyField', ['name', 'url'])


# =================================
# Model Type Transpiler
# ---------------------------------

class ModelTypeTranspiler(object):

    def __init__(self, model_type: ModelType, model_pool: types.ModelPool):
        self.model_type = model_type
        self.model_pool = model_pool
        self.pk_field_info: FieldInfo = None
        self.concrete_fields: List[ConcreteFieldTranspiler] = []
        self.forward_rel_fields: List[ForwardRelFieldTranspiler] = []
        self.m2m_fields: List[ManyToManyFieldTranspiler] = []
        self.reverse_rel_fields: List[ReverseRelFieldTranspiler] = []

        self._resolve_pk_field_info()
        self._build_fields()

    @property
    def _url_prefix(self):
        return self.model_type.base_url() + '/'

    def _resolve_pk_field_info(self):
        for field_info in self.model_type.serializer.field_info:
            if field_info.is_pk:
                self.pk_field_info = field_info

    def _field_lookup_info(self) -> List[types.FieldLookupInfo]:
        lookups = []
        for field_info in self.model_type.serializer.field_info:
            lookups += field_info.lookup_info(model_pool=self.model_pool)
        for rev_rel_field in self.model_type.model_inspector.reverse_relation_fields:

            lookups.append((rev_rel_field.name, rev_rel_field.related_model, None))
        return lookups

    def _build_fields(self):
        """
        Build the field transpilers for the model.


        """
        for field_info in self.model_type.serializer.field_info:
            if isinstance(field_info.model_field, models.ManyToManyField):
                self.m2m_fields.append(
                    ManyToManyFieldTranspiler(
                        model_field=field_info.model_field,
                        serializer_field=field_info.serializer,
                        serializer_field_name=field_info.serializer_field_name,
                    )
                )
                continue
            # Fields that are not forward relations are 'concrete', and are
            # transpiled differently than forward relations.
            if not field_info.is_forward_relation:
                self.concrete_fields.append(
                    ConcreteFieldTranspiler(
                        model_field=field_info.model_field,
                        serializer_field=field_info.serializer,
                        serializer_field_name=field_info.serializer_field_name
                    )
                )
            else:
                self.forward_rel_fields.append(
                    ForwardRelFieldTranspiler(
                        model_field=field_info.model_field,
                        serializer_field=field_info.serializer,
                        serializer_field_name=field_info.serializer_field_name
                    )
                )

        for model_field in self.model_type.model_inspector.reverse_relation_fields:
            if model_field.related_model in self.model_pool:
                self.reverse_rel_fields.append(ReverseRelFieldTranspiler(model_field=model_field))

    def _property_field_interface_declarations(self):
        declarations = []
        if self.model_type.property_fields is not None:
            for property_field_name in self.model_type.property_fields:
                declarations.append(
                    render_type_declaration(name=property_field_name, readonly=True, optional=True, type_='any')
                )
        return declarations

    def _property_field_model_declarations(self):
        declarations = []
        for property_view in self.model_type.property_views:
            declarations.append(
                f"@propertyField((pk) => `{self._url_prefix + property_view.endpoint.url('${pk}')}`, serverClient) {property_view.property_name}"
            )
        return declarations

    def queryset_lookup_types(self):
        type_declarations = []
        for field in self.concrete_fields:
            type_declarations += field.lookup_declarations()
        for field in self.forward_rel_fields:
            if field.model_field.related_model in self.model_pool:
                type_declarations += field.lookup_declarations()
        for field in self.reverse_rel_fields:
            if field.model_field.related_model in self.model_pool:
                type_declarations += field.lookup_declarations()
        for field in self.m2m_fields:
            type_declarations += field.lookup_declarations(
                include_nested=field.model_field.related_model in self.model_pool
            )

        return "\n".join(type_declarations)

    def model_interface_types(self):
        type_declarations = []
        for field_transpiler in self.concrete_fields + self.forward_rel_fields + self.m2m_fields:
            type_declarations.append(field_transpiler.serialized_type_declaration())
        type_declarations += self._property_field_interface_declarations()
        return "\n".join(type_declarations)

    def model_class_types(self):
        type_declarations = []
        # For concrete fields, the 'class type declaration' is the same is the
        # interface/serializer field type declaration.
        for field_transpiler in self.concrete_fields + self.m2m_fields:
            type_declarations.append(field_transpiler.serialized_type_declaration())
        # For forward relation fields, the 'class type declaration' is the same is the
        # interface/serializer field type declaration, but with the addition of a
        # special getter/setter if the related model is contained in the `model_pool`.
        for field_transpiler in self.forward_rel_fields:
            type_declarations.append(field_transpiler.serialized_type_declaration())
            if field_transpiler.model_field.related_model in self.model_pool:
                type_declarations.append(field_transpiler.getter_setter_type_declaration())
        # Reverse relation fields only have a 'class type declaration' if they are a
        # one-to-one field. In that case, they get a special getter/setter just like a
        # forward relation.
        for field_transpiler in self.reverse_rel_fields:
            if field_transpiler.is_one_to_one:
                type_declarations.append(field_transpiler.getter_setter_type_declaration())
        type_declarations += self._property_field_model_declarations()
        return "\n".join(type_declarations)

    def _prefetch_type_body(self):
        prefetch_parts = []
        for field_transpiler in self.forward_rel_fields:
            if field_transpiler.model_field.related_model in self.model_pool:
                prefetch_parts.append(field_transpiler.prefetch_type)
        for field_transpiler in self.m2m_fields:
            if field_transpiler.model_field.related_model in self.model_pool:
                prefetch_parts.append(field_transpiler.prefetch_type)
        for field_transpiler in self.reverse_rel_fields:
            if field_transpiler.prefetch_type and field_transpiler.model_field.related_model in self.model_pool:
                prefetch_parts.append(field_transpiler.prefetch_type)
        if self.model_type.property_fields is not None:
            prefetch_parts += [f"'{f}'" for f in self.model_type.property_fields]
        if not prefetch_parts:
            return 'never'
        return " |\n ".join(prefetch_parts)

    def _methods(self) -> List[ModelMethod]:
        methods = []
        for method_view in self.model_type.method_views:
            methods.append(
                ModelMethod(
                    name=method_view.name,
                    url=self._url_prefix + method_view.endpoint.url(TYPESCRIPT_THIS_PK_REF),
                    sig_interface=method_sig_interface(method_view.arg_serializer_cls, method_view.func_sig),
                )
            )
        return methods

    def _static_methods(self) -> List[ModelMethod]:
        static_methods = []
        for static_method_view in self.model_type.static_method_views:
            static_methods.append(
                ModelMethod(
                    name=static_method_view.name,
                    url=self._url_prefix + static_method_view.endpoint.url(),
                    sig_interface=method_sig_interface(static_method_view.arg_serializer_cls, static_method_view.func_sig),
                )
            )
        return static_methods

    def _property_fields(self) -> List[PropertyField]:
        property_fields = []
        for property_view in self.model_type.property_views:
            property_fields.append(
                PropertyField(
                    name=property_view.name,
                    url=self._url_prefix + property_view.endpoint.url(TYPESCRIPT_THIS_PK_REF),
                )
            )
        return property_fields

    def _reverse_relations(self) -> List[ReverseRelFieldTranspiler]:
        reverse_relations = []
        for field_transpiler in self.reverse_rel_fields:
            # Reverse relations that are one-to-one don't get a filterable
            # method because they have a getter/setter.
            if not field_transpiler.is_one_to_one:
                reverse_relations.append(field_transpiler)
        return reverse_relations

    def field_schemas(self):
        field_schemas = []
        for field_transpiler in self.concrete_fields:
            field_schemas.append(
                field_transpiler.serializer_field_name + ": " + field_transpiler.schema()
            )
        for field_transpiler in self.forward_rel_fields:
            if field_transpiler.model_field.related_model in self.model_pool:
                field_schemas.append(
                    field_transpiler.serializer_field_name + ": " + field_transpiler.schema()
                )
        for field_transpiler in self.m2m_fields:
            field_schemas.append(
                field_transpiler.serializer_field_name + ": " + field_transpiler.schema()
            )
        return ", \n".join(field_schemas)

    def transpile(self):
        template = TypeScriptTemplate.open(templates.MODEL_TYPE_TEMPLATE_FILE)
        source = template.render(
            pk_field_name=self.pk_field_info.serializer_field_name,
            pk_type=FieldTypeTranspiler.transpile(self.pk_field_info.serializer),
            model_name=self.model_type.model_name,
            queryset_name=model_queryset_name(self.model_type.model_cls),
            field_interface_name=model_field_interface_name(self.model_type.model_cls),
            # URLS
            update_url=self._url_prefix + self.model_type.update_view.endpoint.url(TYPESCRIPT_THIS_PK_REF),
            get_url=self._url_prefix + self.model_type.get_view.endpoint.url(TYPESCRIPT_ARG_PK_REF),
            get_or_create_url=self._url_prefix + self.model_type.get_or_create_view.endpoint.url(),
            create_url=self._url_prefix + self.model_type.create_view.endpoint.url(TYPESCRIPT_ARG_PK_REF),
            # Todo: fix hacky
            list_url=self._url_prefix + self.model_type.list_view.endpoint.url().replace('//', '/'),
            delete_url=self._url_prefix + self.model_type.delete_view.endpoint.url(TYPESCRIPT_THIS_PK_REF),
            # -----
            model_interface_types=self.model_interface_types(),
            model_class_types=self.model_class_types(),
            lookups_interface_name=model_lookups_name(self.model_type.model_cls),
            queryset_lookups=self.queryset_lookup_types(),
            reverse_relations=self._reverse_relations(),
            methods=self._methods(),
            static_methods=self._static_methods(),
            field_schemas=self.field_schemas(),
            prefetch_type_name=model_prefetch_type_name(self.model_type.model_cls),
            prefetch_type=self._prefetch_type_body()
        )
        return source
