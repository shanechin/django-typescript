import datetime
import enum
from typing import Dict, List, Optional

from django.db import models
from django.db.models.lookups import In
from django.test import TestCase
from rest_framework import serializers

from django_typescript.transpile.field_type import FieldTypeTranspiler
from django_typescript.transpile.python_types import python_type_to_typescript


class Color(enum.Enum):
    RED = 'red'
    BLUE = 'blue'


class TestFieldTypeTranspiler(TestCase):

    def test_integer_variants_map_to_number(self):
        integer_fields = [
            models.IntegerField,
            models.SmallIntegerField,
            models.BigIntegerField,
            models.PositiveIntegerField,
            models.PositiveSmallIntegerField,
            models.PositiveBigIntegerField,
            models.AutoField,
            models.BigAutoField,
            models.SmallAutoField,
            serializers.IntegerField,
        ]
        big_integer_field = getattr(serializers, 'BigIntegerField', None)
        if big_integer_field is not None:
            integer_fields.append(big_integer_field)
        for field_cls in integer_fields:
            with self.subTest(field=field_cls.__name__):
                self.assertEqual(FieldTypeTranspiler.transpile(field_cls()), 'number')
                self.assertEqual(
                    FieldTypeTranspiler.transpile(field_cls(), container_type=In),
                    'number[]',
                )

    def test_boolean_and_temporal_serializer_fields(self):
        self.assertEqual(FieldTypeTranspiler.transpile(serializers.BooleanField()), 'boolean')
        self.assertEqual(FieldTypeTranspiler.transpile(serializers.DecimalField(max_digits=6, decimal_places=2)), 'number')
        self.assertEqual(FieldTypeTranspiler.transpile(serializers.DateTimeField()), 'string')
        self.assertEqual(FieldTypeTranspiler.transpile(models.BooleanField()), 'boolean')


class TestPythonTypeHints(TestCase):

    def test_builtin_and_container_hints(self):
        self.assertEqual(python_type_to_typescript(int), 'number')
        self.assertEqual(python_type_to_typescript(str), 'string')
        self.assertEqual(python_type_to_typescript(bool), 'boolean')
        self.assertEqual(python_type_to_typescript(list[int]), 'number[]')
        self.assertEqual(python_type_to_typescript(List[str]), 'string[]')
        self.assertEqual(python_type_to_typescript(dict[str, int]), 'Record<string, number>')
        self.assertEqual(python_type_to_typescript(Dict[str, bool]), 'Record<string, boolean>')
        self.assertEqual(python_type_to_typescript(Optional[int]), 'number | null')
        self.assertEqual(python_type_to_typescript(int | None), 'number | null')
        self.assertEqual(python_type_to_typescript(datetime.datetime), 'string')
        self.assertEqual(python_type_to_typescript(Color), "'red' | 'blue'")
