import typing

from django.db import models
from rest_framework import serializers
from rest_framework.permissions import BasePermission


# =================================
# Permissions
# ---------------------------------

PermissionClasses = typing.Optional[typing.Tuple[typing.Type[BasePermission]]]


# =================================
# Serializers
# ---------------------------------

SerializerClass = typing.Type[serializers.Serializer]

FieldSerializer = serializers.Field

ModelSerializer = serializers.ModelSerializer

ModelSerializerClass = typing.Type[serializers.ModelSerializer]


# =================================
# Models
# ---------------------------------

ModelClass = typing.Type[models.Model]

ModelPool = typing.List[ModelClass]


# =================================
# Model Fields
# ---------------------------------

ModelField = models.Field

OneToOneProxyFields = typing.Dict[str, typing.List[str]]

ForwardRelationField = typing.Union[models.ForeignKey, models.OneToOneField]

ReverseRelationField = models.ManyToOneRel

RelationField = typing.Union[ForwardRelationField, ReverseRelationField]

LookupClass = typing.Type[models.Lookup]

FieldLookupInfo = typing.Tuple[str, typing.Union[ModelField, ModelClass], typing.Union[LookupClass, None]]


# =================================
# Model Fields Type Checking
# ---------------------------------

FORWARD_RELATION_FIELDS = (models.ForeignKey, models.OneToOneField)
REVERSE_RELATION_FIELDS = (models.ManyToOneRel, models.ManyToManyRel)


def field_is_reverse_relation(field: ModelField) -> bool:
    return isinstance(field, REVERSE_RELATION_FIELDS)


def field_is_forward_relation(field: ModelField) -> bool:
    return isinstance(field, FORWARD_RELATION_FIELDS)


def field_is_relation(field: ModelField) -> bool:
    return isinstance(field, REVERSE_RELATION_FIELDS + FORWARD_RELATION_FIELDS + (models.ManyToManyField,))


# =================================
# Prefetch Tree
# ---------------------------------

PrefetchTree = typing.Union[str, typing.Dict[str, typing.Union['PrefetchTree', typing.List['PrefetchTree']]]]

