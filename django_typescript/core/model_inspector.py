from typing import Type, List

from django.utils.functional import cached_property
from django.db import models

from django_typescript.core import types


# =================================
# Model Inspector
# ---------------------------------

class ModelInspector(object):

    def __init__(self, model_cls: Type[models.Model]):
        self.model_cls = model_cls
        self.model_fields: List[models.Field] = model_cls._meta.get_fields()

    @property
    def pk_field_name(self) -> str:
        """
        Return the name of the primary key field of this `ModelInspector`'s
        model.

        """
        return self.pk_field.name

    @property
    def pk_field(self) -> models.Field:
        """
        Return the primary key field instance of this `ModelInspector`'s
        model.

        """
        return self.model_cls._meta.pk

    @cached_property
    def forward_relation_fields(self) -> List[types.ForwardRelationField]:
        return [f for f in self.model_fields if isinstance(f, types.FORWARD_RELATION_FIELDS)]

    @cached_property
    def reverse_relation_fields(self) -> List[types.ReverseRelationField]:
        return [f for f in self.model_fields if isinstance(f, types.REVERSE_RELATION_FIELDS)]

    @cached_property
    def reverse_one_to_one_fields(self) -> List[models.OneToOneRel]:
        return [f for f in self.model_fields if isinstance(f, models.OneToOneRel)]

    @property
    def relation_fields(self) -> List[types.RelationField]:
        return self.forward_relation_fields + self.reverse_relation_fields

    @cached_property
    def many_to_many_fields(self) -> List[models.ManyToManyField]:
        return [f for f in self.model_fields if isinstance(f, models.ManyToManyField)]

    @cached_property
    def concrete_fields(self):
        skipped = set(self.relation_fields) | set(self.many_to_many_fields)
        return [f for f in self.model_fields if f not in skipped]






