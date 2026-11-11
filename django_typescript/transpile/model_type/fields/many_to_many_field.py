from django.db import models

from django_typescript.core import types, typescript_types
from django_typescript.transpile.common import render_type_declaration
from django_typescript.transpile.field_type import FieldTypeTranspiler
from django_typescript.transpile.literal import LiteralTranspiler
from django_typescript.transpile.model_type.common import (
    model_lookups_name,
    model_prefetch_type_name,
)


# =================================
# Many To Many Field Transpiler
# ---------------------------------

class ManyToManyFieldTranspiler(object):

    """
    Many-to-many fields are serialized as arrays of related primary keys
    (DRF's ``PrimaryKeyRelatedField(many=True)``) and can be filtered by
    those keys or by the related model's lookups.

    """

    def __init__(self, serializer_field_name: str, model_field: types.ModelField,
                 serializer_field: types.FieldSerializer):
        self.serializer_field_name = serializer_field_name
        self.model_field = model_field
        self.serializer_field = serializer_field

    def _related_pk_field(self):
        pk = self.model_field.related_model._meta.pk
        seen = set()
        while isinstance(pk, (models.ForeignKey, models.OneToOneField)) and id(pk) not in seen:
            seen.add(id(pk))
            pk = pk.related_model._meta.pk
        return pk

    def _pk_type(self) -> str:
        return FieldTypeTranspiler.transpile(self._related_pk_field())

    @property
    def serialized_type(self) -> str:
        return f"{self._pk_type()}[]"

    def serialized_type_declaration(self) -> str:
        required = getattr(self.serializer_field, 'required', True)
        allow_null = getattr(self.serializer_field, 'allow_null', False)
        return render_type_declaration(
            name=self.serializer_field_name,
            optional=(not required) or bool(allow_null),
            readonly=bool(getattr(self.serializer_field, 'read_only', False)),
            type_=self.serialized_type,
        )

    def lookup_declarations(self, include_nested: bool = False):
        pk_type = self._pk_type()
        name = self.model_field.name
        direct_type = pk_type
        if include_nested:
            direct_type = f"{pk_type} | {model_lookups_name(self.model_field.related_model)}"
        return [
            render_type_declaration(name=name, optional=True, readonly=False, type_=direct_type),
            render_type_declaration(name=f"{name}__in", optional=True, readonly=False, type_=f"{pk_type}[]"),
            render_type_declaration(
                name=f"{name}__isnull", optional=True, readonly=False, type_=typescript_types.BOOLEAN
            ),
        ]

    def schema(self) -> str:
        read_only = LiteralTranspiler.transpile(bool(getattr(self.serializer_field, 'read_only', False)))
        nullable = LiteralTranspiler.transpile(bool(getattr(self.model_field, 'null', False)))
        body = (
            f"fieldName:'{self.serializer_field_name}',"
            f"fieldType:'ManyToManyField',"
            f"nullable:{nullable},"
            f"isReadOnly:{read_only},"
            f"relatedModel: () => {self.model_field.related_model.__name__}"
        )
        return "{ " + body + " }"

    @property
    def prefetch_type(self) -> str:
        base_key = self.model_field.name
        related_prefetch_type = model_prefetch_type_name(self.model_field.related_model)
        return f"'{base_key}' | {{{base_key}: {related_prefetch_type} | {related_prefetch_type}[]}}"
