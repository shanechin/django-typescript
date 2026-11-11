import inspect

from django.db import models
from django.db.models import lookups
from django.db.models.fields import related_lookups
from rest_framework import serializers

from django_typescript.core import typescript_types
from django_typescript import config


def _optional_array_field():
    """Return Django's postgres ArrayField when that contrib app can be imported."""
    try:
        from django.contrib.postgres.fields import ArrayField
    except Exception:
        return None
    return ArrayField


def _is_subclass(cls, parent) -> bool:
    try:
        return inspect.isclass(cls) and inspect.isclass(parent) and issubclass(cls, parent)
    except TypeError:
        return False


# =================================
# Type Transpiler
# ---------------------------------

class FieldTypeTranspiler(object):

    _DEFAULT_TYPE = staticmethod(lambda x: typescript_types.ANY)

    TYPE_TRANSPILERS = {
        # Serializer field types
        serializers.IntegerField: lambda x: typescript_types.NUMBER,
        serializers.FloatField: lambda x: typescript_types.NUMBER,
        serializers.DecimalField: lambda x: typescript_types.NUMBER,
        serializers.BooleanField: lambda x: typescript_types.BOOLEAN,
        serializers.CharField: lambda x: typescript_types.STRING,
        serializers.EmailField: lambda x: typescript_types.STRING,
        serializers.URLField: lambda x: typescript_types.STRING,
        serializers.SlugField: lambda x: typescript_types.STRING,
        serializers.UUIDField: lambda x: typescript_types.STRING,
        serializers.IPAddressField: lambda x: typescript_types.STRING,
        serializers.TimeField: lambda x: typescript_types.STRING,
        serializers.DurationField: lambda x: typescript_types.STRING,
        serializers.FileField: lambda x: typescript_types.STRING,
        serializers.ImageField: lambda x: typescript_types.STRING,
        serializers.JSONField: lambda x: typescript_types.OBJECT,
        serializers.ListField: lambda x: FieldTypeTranspiler.transpile(x.child) + "[]",
        serializers.ListSerializer: lambda x: FieldTypeTranspiler.transpile(x.child) + "[]",
        serializers.PrimaryKeyRelatedField: lambda x: FieldTypeTranspiler.transpile(x.queryset.model),
        # Date(Time) serializer values are sent as strings.
        serializers.DateTimeField: lambda x: typescript_types.STRING,
        serializers.DateField: lambda x: typescript_types.STRING,
        # Django model field types
        models.JSONField: lambda x: typescript_types.OBJECT,
        models.CharField: lambda x: typescript_types.STRING,
        models.TextField: lambda x: typescript_types.STRING,
        models.UUIDField: lambda x: typescript_types.STRING,
        models.SlugField: lambda x: typescript_types.STRING,
        models.EmailField: lambda x: typescript_types.STRING,
        models.URLField: lambda x: typescript_types.STRING,
        models.IntegerField: lambda x: typescript_types.NUMBER,
        models.SmallIntegerField: lambda x: typescript_types.NUMBER,
        models.BigIntegerField: lambda x: typescript_types.NUMBER,
        models.PositiveIntegerField: lambda x: typescript_types.NUMBER,
        models.PositiveSmallIntegerField: lambda x: typescript_types.NUMBER,
        models.PositiveBigIntegerField: lambda x: typescript_types.NUMBER,
        models.DecimalField: lambda x: typescript_types.NUMBER,
        models.FloatField: lambda x: typescript_types.NUMBER,
        models.AutoField: lambda x: typescript_types.NUMBER,
        models.BigAutoField: lambda x: typescript_types.NUMBER,
        models.SmallAutoField: lambda x: typescript_types.NUMBER,
        models.BooleanField: lambda x: typescript_types.BOOLEAN,
        models.DateTimeField: lambda x: typescript_types.STRING,
        models.DateField: lambda x: typescript_types.STRING,
        models.TimeField: lambda x: typescript_types.STRING,
        models.ForeignKey: lambda x: x.related_model.__name__,
        models.OneToOneField: lambda x: x.related_model.__name__,
        models.ManyToManyField: lambda x: x.related_model.__name__ + "[]",
        models.ManyToOneRel: lambda x: x.related_model.__name__,
        # Model type
        models.Model: lambda x: x.__name__,
        # Container types
        lookups.In: lambda x: f'{x}[]',
        lookups.IsNull: lambda x: typescript_types.BOOLEAN,
        related_lookups.RelatedIn: lambda x: f'{x}[]',
        lookups.Range: lambda x: f'[{x}, {x}]',
    }

    @classmethod
    def _base_type(cls, type_):
        if not inspect.isclass(type_):
            return type(type_)
        return type_

    @classmethod
    def _is_integer_type(cls, base_type) -> bool:
        """
        Every Django integer variant (Small, Big, Positive*, Auto*) and DRF's
        IntegerField/BigIntegerField should be a TypeScript number.

        """
        return _is_subclass(base_type, models.IntegerField) or _is_subclass(base_type, serializers.IntegerField)

    @classmethod
    def _configured_type(cls, base_type):
        for registered, data in config.FIELD_TYPES.items():
            if not isinstance(data, dict) or 'typescript_type' not in data:
                continue
            if base_type == data.get('serializer_class') or base_type == registered:
                return data['typescript_type']
        return None

    @classmethod
    def _root_type(cls, type_):
        # `many=True` constructs a ListSerializer. Emit an array of the child type.
        if not inspect.isclass(type_) and getattr(type_, 'many', False) and getattr(type_, 'child', None) is not None:
            inner = cls.transpile(type_.child)
            if not str(inner).endswith('[]'):
                return f"{inner}[]"
            return inner

        base_type = cls._base_type(type_)
        configured = cls._configured_type(base_type)
        if configured is not None:
            return configured
        if cls._is_integer_type(base_type):
            return typescript_types.NUMBER
        transpiler = cls.TYPE_TRANSPILERS.get(base_type, cls._DEFAULT_TYPE)
        return transpiler(type_)

    @classmethod
    def transpile(cls, type_, container_type=None):
        root_type = cls._root_type(type_)
        if not container_type or container_type not in cls.TYPE_TRANSPILERS:
            return root_type
        return cls.TYPE_TRANSPILERS[container_type](root_type)


_ArrayField = _optional_array_field()
if _ArrayField is not None:
    FieldTypeTranspiler.TYPE_TRANSPILERS[_ArrayField] = (
        lambda x: FieldTypeTranspiler.transpile(x.base_field) + "[]"
    )

# Removed from DRF and, on newer Django, from django.db.models. Map it only when present.
_NullBooleanField = getattr(models, 'NullBooleanField', None)
if _NullBooleanField is not None:
    FieldTypeTranspiler.TYPE_TRANSPILERS[_NullBooleanField] = (
        lambda x: f"{typescript_types.BOOLEAN} | {typescript_types.NULL}"
    )
_NullBooleanSerializer = getattr(serializers, 'NullBooleanField', None)
if _NullBooleanSerializer is not None:
    FieldTypeTranspiler.TYPE_TRANSPILERS[_NullBooleanSerializer] = lambda x: typescript_types.BOOLEAN
