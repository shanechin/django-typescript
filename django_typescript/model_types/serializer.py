from typing import Dict, Callable, List, Union

from django.db import models
from rest_framework import serializers
from rest_framework.utils.field_mapping import get_field_kwargs, UniqueValidator

from django_typescript.core import types
from django_typescript import config
from django_typescript.core.field_info import FieldInfo
from django_typescript.core.model_inspector import ModelInspector
from django_typescript.model_types.validator import ModelTypeValidator


# =================================
# Serializer Registry
# ---------------------------------

_REGISTRY: Dict[types.ModelClass, 'ModelTypeSerializer'] = {}


# =================================
# Model Type Serializer
# ---------------------------------

class ModelTypeSerializer(object):

    AUTO_FIELD_SERIALIZER = serializers.IntegerField

    def __init__(self, model_cls: types.ModelClass, validate_func: Callable = None, serializer_field_kwargs: dict = None,
                 one_to_one_proxy_fields: types.OneToOneProxyFields=None, property_fields: List[str] = None):
        self.model_cls = model_cls
        self.validator = ModelTypeValidator(validate_func=validate_func) if validate_func else None
        self.serializer_field_kwargs = serializer_field_kwargs if serializer_field_kwargs is not None else {}
        self.one_to_one_proxy_fields = one_to_one_proxy_fields
        self.property_field_names = property_fields
        self.model_inspector = ModelInspector(model_cls=model_cls)
        self.concrete_fields: Dict[str, types.FieldSerializer] = {}
        self.property_fields: Dict[str, types.FieldSerializer] = {}
        self.forward_rel_fields: Dict[str, types.FieldSerializer] = {}
        self.forward_rel_model_fields: Dict[str, types.ModelField] = {}
        self.field_info: List[FieldInfo] = []
        self.pk_field_info: FieldInfo = None
        self.base_serializer_cls: types.ModelSerializerClass = None
        self._build_fields()
        self._build_serializer_cls()
        self._check_validate_func()

    @property
    def field_names(self):
        return list(self.concrete_fields.keys()) + list(self.forward_rel_fields.keys())

    def _check_validate_func(self):
        if self .validator:
            assert len(set(self.validator.validator_field_names) - set(self._allowed_validator_field_names)) == 0, (
                'One or more arguments of provided `validate` method does not correspond to a field name.'
            )

    def _build_fields(self):
        self._build_concrete_fields()
        self._build_forward_relation_fields()
        self._build_many_to_many_fields()
        self._build_property_fields()

    def _instantiate_field(self, field_class, field_kwargs):
        """
        Build a serializer field.

        DRF's ``BigIntegerField`` stringifies values when
        ``COERCE_BIGINT_TO_STRING`` is on (the default), which makes every
        big-integer variant show up as a string in JSON. Integer fields are
        numbers in the generated TypeScript, so keep the wire value numeric.
        """
        kwargs = dict(field_kwargs)
        # DRF added serializers.BigIntegerField in 3.17. Older releases use IntegerField.
        big_integer_field = getattr(serializers, 'BigIntegerField', None)
        if (
            big_integer_field is not None
            and isinstance(field_class, type)
            and issubclass(field_class, big_integer_field)
        ):
            kwargs['coerce_to_string'] = False
        return field_class(**kwargs)

    def _build_concrete_fields(self):
        helper_serializer = serializers.ModelSerializer()
        for model_field in self.model_inspector.concrete_fields:
            if type(model_field) in config.FIELD_TYPES:
                field_class, field_kwargs = config.FIELD_TYPES[type(model_field)]['serializer_class'], {'required': not model_field.null}
            else:
                field_class, field_kwargs = helper_serializer.build_standard_field(model_field.name, model_field)
            kwarg_overrides = self.serializer_field_kwargs.get(model_field.name, {})
            field_serializer = self._instantiate_field(field_class, {**field_kwargs, **kwarg_overrides})
            self.concrete_fields[model_field.name] = field_serializer
            self.field_info.append(
                FieldInfo(serializer_field_name=model_field.name, model_field=model_field, serializer=field_serializer)
            )
        if self.one_to_one_proxy_fields is not None:
            for one_to_one_field_name, proxy_fields in self.one_to_one_proxy_fields.items():
                for proxy_field_name in proxy_fields:
                    one_to_one_field = self.model_cls._meta.get_field(one_to_one_field_name)
                    related_model_cls = one_to_one_field.related_model
                    model_proxy_field = related_model_cls._meta.get_field(proxy_field_name)
                    field_class, field_kwargs = helper_serializer.build_standard_field(model_proxy_field.name, model_proxy_field)
                    kwarg_overrides = self.serializer_field_kwargs.get(model_proxy_field.name, {})
                    field_serializer = self._instantiate_field(
                        field_class,
                        {**field_kwargs, **kwarg_overrides, **{'source': one_to_one_field.name + '.' + model_proxy_field.name}},
                    )
                    self.concrete_fields[model_proxy_field.name] = field_serializer
                    self.field_info.append(
                        FieldInfo(serializer_field_name=model_proxy_field.name, model_field=model_proxy_field,
                                  serializer=field_serializer)
                    )

    def _forward_rel_field_kwargs(self, model_field: types.ModelField):
        kwargs = {}
        kwarg_overrides = self.serializer_field_kwargs.get(model_field.name, {})
        if model_field.has_default() or model_field.blank or model_field.null:
            kwargs['required'] = False
        if model_field.null:
            kwargs['allow_null'] = True
        if model_field.validators:
            kwargs['validators'] = model_field.validators
        if getattr(model_field, 'unique', False):
            validator = UniqueValidator(queryset=model_field.model._default_manager)
            kwargs['validators'] = kwargs.get('validators', []) + [validator]
        return {**kwargs, **kwarg_overrides}

    def _resolve_forward_rel_field_type(self, model_field: types.ForwardRelationField):
        pk_field = model_field.related_model._meta.pk
        if isinstance(pk_field, models.AutoField):
            return self.AUTO_FIELD_SERIALIZER
        if isinstance(pk_field, models.OneToOneField):
            return self._resolve_forward_rel_field_type(pk_field)
        return serializers.ModelSerializer.serializer_field_mapping[type(pk_field)]

    def _build_forward_relation_fields(self):
        for model_field in self.model_inspector.forward_relation_fields:
            field_class = self._resolve_forward_rel_field_type(model_field=model_field)
            field_kwargs = self._forward_rel_field_kwargs(model_field=model_field)
            field_serializer = self._instantiate_field(field_class, field_kwargs)
            field_name = model_field.get_attname()
            self.forward_rel_fields[field_name] = field_serializer
            self.forward_rel_model_fields[field_name] = model_field
            self.field_info.append(
                FieldInfo(serializer_field_name=field_name, model_field=model_field, serializer=field_serializer)
            )

    def _build_many_to_many_fields(self):
        for model_field in self.model_inspector.many_to_many_fields:
            kwarg_overrides = dict(self.serializer_field_kwargs.get(model_field.name, {}))
            read_only = kwarg_overrides.get('read_only', not model_field.editable)
            kwargs = {
                'many': True,
                'required': False if read_only else not model_field.blank,
            }
            if not read_only:
                kwargs['queryset'] = model_field.related_model._default_manager.all()
                kwargs['allow_empty'] = bool(model_field.blank)
            else:
                kwargs['read_only'] = True
            kwargs.update(kwarg_overrides)
            if kwargs.get('read_only'):
                kwargs.pop('queryset', None)
                kwargs.pop('allow_empty', None)
            field_serializer = serializers.PrimaryKeyRelatedField(**kwargs)
            field_name = model_field.name
            self.forward_rel_fields[field_name] = field_serializer
            self.forward_rel_model_fields[field_name] = model_field
            self.field_info.append(
                FieldInfo(serializer_field_name=field_name, model_field=model_field, serializer=field_serializer)
            )

    def _build_property_fields(self):
        if self.property_field_names is not None:
            for property_field_name in self.property_field_names:
                self.property_fields[property_field_name] = self._property_field_serializer()

    def _property_field_serializer(self):
        return serializers.JSONField(read_only=True)

    def _resolve_validator_forward_relations(self, data: dict):
        resolved_relations = {}
        for k, v in data.items():
            if k in self.forward_rel_model_fields and v is not None:
                model_field = self.forward_rel_model_fields[k]
                if model_field.name not in self.validator.validator_field_names:
                    continue
                if getattr(model_field, 'many_to_many', False):
                    items = v if isinstance(v, (list, tuple)) else [v]
                    resolved = []
                    for item in items:
                        if isinstance(item, models.Model):
                            resolved.append(item)
                        else:
                            resolved.append(model_field.related_model.objects.get(pk=item))
                    resolved_relations[model_field.name] = resolved
                    continue
                resolved_relations[model_field.name] = model_field.related_model.objects.get(pk=v)
        return resolved_relations

    def _build_serializer_cls(self):

        class Meta:
            model = self.model_cls
            fields = self.field_names

        def validate(_self, attrs):
            if self.validator:
                resolved_relations = self._resolve_validator_forward_relations(attrs)
                if _self.partial:
                    for validator_field_name in self.validator.validator_field_names:
                        if validator_field_name not in attrs:
                            attrs[validator_field_name] = getattr(_self.instance, validator_field_name)
                self.validator.validate(**{**attrs, **resolved_relations})
            return serializers.ModelSerializer.validate(_self, attrs)
        class_dict = {
            **{'Meta': Meta, 'validate': validate},
            **self.concrete_fields,
            **self.forward_rel_fields
        }
        serializer_cls = type(self.model_cls.__name__ + "Serializer", (serializers.ModelSerializer,), class_dict)
        self.base_serializer_cls = serializer_cls

    @property
    def _allowed_validator_field_names(self):
        allowed_names = list(self.concrete_fields.keys()) + list(self.forward_rel_fields.keys()) + \
                      [f.name for f in self.forward_rel_model_fields.values()]
        return allowed_names

    @staticmethod
    def _prefetch_is_many(model_field) -> bool:
        if getattr(model_field, 'one_to_one', False):
            return False
        return bool(getattr(model_field, 'many_to_many', False) or getattr(model_field, 'one_to_many', False))

    def _build_prefetch_serializer(self, prefetch_field: str):
        # If the prefetch_field is not a model field, it must be a 'property field'.
        try:
            model_field = self.model_cls._meta.get_field(prefetch_field)
            serializer = ModelTypeSerializer(model_cls=model_field.related_model)
            serializer_cls = serializer.base_serializer_cls
            return serializer_cls(many=self._prefetch_is_many(model_field))
        except models.FieldDoesNotExist:
            return self._property_field_serializer()

    def build_prefetch_serializer_tree(self, prefetch_trees: List[types.PrefetchTree]) -> types.ModelSerializerClass:
        prefetch_fields = dict()
        for prefetch_tree in prefetch_trees:
            if isinstance(prefetch_tree, str):
                prefetch_field = prefetch_tree
                prefetch_fields[prefetch_field] = self._build_prefetch_serializer(prefetch_field=prefetch_field)
            elif isinstance(prefetch_tree, list):
                for prefetch_field in prefetch_tree:
                    prefetch_fields[prefetch_field] = self._build_prefetch_serializer(prefetch_field=prefetch_field)
            else:
                for k, v in prefetch_tree.items():
                    model_field = self.model_cls._meta.get_field(k)
                    serializer = ModelTypeSerializer(model_cls=model_field.related_model)
                    serializer_cls = serializer.build_prefetch_serializer_tree([v])
                    prefetch_fields[model_field.name] = serializer_cls(many=self._prefetch_is_many(model_field))

        class Meta:
            model = self.model_cls
            fields = list(dict.fromkeys(list(self.field_names) + list(prefetch_fields.keys())))

        class_dict = {
            **{'Meta': Meta},
            **self.concrete_fields,
            **self.forward_rel_fields,
            **prefetch_fields
        }
        serializer_cls = type(self.model_cls.__name__ + "PrefetchSerializer", (serializers.ModelSerializer,), class_dict)
        return serializer_cls


