import json
import pathlib
import tempfile

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import serializers
from rest_framework.test import APIClient

from django_typescript import interface
from django_typescript.core.model_inspector import ModelInspector
from django_typescript.transpile import Transpiler

from .models import Article, Tag


class ArticleType(interface.ModelType, model_cls=Article):

    @interface.ModelType.method()
    def hinted(self, count: int, label: str, flag: bool = False, maybe: int | None = None):
        return {'count': count, 'label': label, 'flag': flag, 'maybe': maybe}

    @interface.ModelType.method(count=serializers.CharField())
    def mixed(self, count: int, extra: bool):
        return {'count': count, 'extra': extra}

    @interface.ModelType.static_method()
    def hinted_static(cls, total: int, name: str = 'n'):
        return {'total': total, 'name': name}


class TagType(interface.ModelType, model_cls=Tag):
    pass


class NoteSerializer(serializers.Serializer):
    name = serializers.CharField()


class NoteType(interface.ObjectType, serializer_cls=NoteSerializer):

    def __init__(self, name):
        self.name = name

    @interface.ObjectType.method()
    def shift(self, hours: int, label: str = 'x'):
        return {'hours': hours, 'label': label}


class Interface(interface.Interface, transpile_dest=''):
    tags = TagType.as_type()
    articles = ArticleType.as_type()
    notes = NoteType


urlpatterns = Interface.urlpatterns()


@override_settings(ROOT_URLCONF=__name__)
class TestManyToManyAPI(TestCase):

    def setUp(self):
        self.client = APIClient()

    def test_inspector_classifies_many_to_many(self):
        article_inspector = ModelInspector(Article)
        tag_inspector = ModelInspector(Tag)
        self.assertIn('tags', [field.name for field in article_inspector.many_to_many_fields])
        self.assertNotIn('tags', [field.name for field in article_inspector.concrete_fields])
        self.assertIn('articles', [field.name for field in tag_inspector.reverse_relation_fields])

    def test_create_read_update_many_to_many_and_integer_fields(self):
        tag = Tag.objects.create(name='red')
        created = self.client.post(
            reverse('article:create'),
            data={
                'title': 'Hello',
                'tags': [tag.id],
                'small_number': 2,
                'positive_small': 3,
                'big_number': 99,
                'positive_big': 100,
                'positive_number': 4,
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['tags'], [tag.id])
        for key in ('small_number', 'positive_small', 'big_number', 'positive_big', 'positive_number'):
            self.assertIsInstance(created.data[key], int)
            self.assertNotIsInstance(created.data[key], bool)
        article = Article.objects.get(pk=created.data['id'])
        self.assertEqual(list(article.tags.values_list('id', flat=True)), [tag.id])

        other = Tag.objects.create(name='blue')
        updated = self.client.post(
            reverse('article:update', kwargs={'pk': article.id}),
            data={'tags': [other.id]},
            format='json',
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data['tags'], [other.id])

        empty = self.client.post(reverse('article:create'), data={'title': 'Bare'}, format='json')
        self.assertEqual(empty.status_code, 201, empty.data)
        self.assertEqual(empty.data['tags'], [])

    def test_filter_and_prefetch_many_to_many(self):
        tag = Tag.objects.create(name='red')
        other = Tag.objects.create(name='blue')
        match = Article.objects.create(title='Match')
        match.tags.add(tag)
        skipped = Article.objects.create(title='Skip')
        skipped.tags.add(other)

        query = {'filters': {'tags': tag.id}, 'exclude': {}, 'or_': []}
        listed = self.client.get(reverse('article:list') + '?query=' + json.dumps(query))
        self.assertEqual(listed.status_code, 200)
        self.assertEqual([row['title'] for row in listed.data], ['Match'])

        prefetched = self.client.get(reverse('article:list') + '?prefetch=' + json.dumps(['tags']))
        self.assertEqual(prefetched.status_code, 200, prefetched.data)
        match_row = next(row for row in prefetched.data if row['title'] == 'Match')
        self.assertEqual(match_row['tags'][0]['name'], 'red')

        reverse_rows = self.client.get(reverse('tag:list') + '?prefetch=' + json.dumps(['articles']))
        self.assertEqual(reverse_rows.status_code, 200, reverse_rows.data)
        red = next(row for row in reverse_rows.data if row['name'] == 'red')
        self.assertEqual(red['articles'][0]['title'], 'Match')

    def test_page_values_query_passes_page_arguments(self):
        for index in range(3):
            Article.objects.create(title=f't{index}')
        url = reverse('article:list')
        url += '?page=2&pageSize=1&values=' + json.dumps(['title'])
        url += '&order_by=' + json.dumps(['id'])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['num_results'], 3)
        self.assertEqual(response.data['num_pages'], 3)
        self.assertEqual(response.data['page'], 2)
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(set(response.data['data'][0].keys()), {'title'})
        self.assertEqual(response.data['data'][0]['title'], 't1')

        legacy = self.client.get(
            reverse('article:list') + '?page=1&pagesize=1&order_on=' + json.dumps(['id'])
        )
        self.assertEqual(legacy.status_code, 200, legacy.data)
        self.assertEqual(legacy.data['num_pages'], 3)
        self.assertEqual(len(legacy.data['data']), 1)


class TestGeneratedClient(TestCase):

    def _transpile(self, destination):
        class LocalInterface(interface.Interface, transpile_dest=pathlib.Path(destination)):
            tags = TagType.as_type()
            articles = ArticleType.as_type()
            notes = NoteType

        Transpiler(interface=LocalInterface).transpile()
        return pathlib.Path(destination)

    def test_generated_models_include_m2m_integers_and_hints(self):
        with tempfile.TemporaryDirectory() as destination:
            root = self._transpile(destination)
            models = (root / 'server' / 'models.ts').read_text()
            objects = (root / 'server' / 'objects.ts').read_text()
            client = (root / 'server' / 'core' / 'serverClient.ts').read_text()

            self.assertIn('tags?: number[]', models)
            self.assertIn('tags?: number | TagQuerySetLookups', models)
            self.assertIn('tags__in?: number[]', models)
            self.assertIn('articles(lookups:', models)
            self.assertIn('tags: this.pk()', models)
            self.assertIn("fieldType:'ManyToManyField'", models)

            for field_name in (
                'small_number', 'positive_small', 'big_number', 'positive_big', 'positive_number'
            ):
                self.assertIn(f'{field_name}?: number', models)
                self.assertIn(f'{field_name}__exact?: number', models)
                self.assertNotIn(f'{field_name}?: string', models)
                self.assertNotIn(f'{field_name}__exact?: string', models)
            self.assertRegex(models, r'active\??: boolean')
            self.assertNotRegex(models, r'active\??: any')

            self.assertIn(
                'hinted(data: {count: number, label: string, flag?: boolean, maybe?: number})',
                models,
            )
            self.assertIn('mixed(data: {count: string, extra: boolean})', models)
            self.assertIn('hinted_static(data: {total: number, name?: string})', models)
            self.assertIn('return await this._retrieve(pageNum, pageSize)', models)
            self.assertIn('shift(data: {hours: number, label?: string})', objects)

            self.assertIn('export const buildUrlQuery', client)
            self.assertIn('return parts.join', client)
            self.assertIn(
                'prefetch: this.prefetchKeys === undefined ? undefined : JSON.stringify(this.prefetchKeys)',
                client,
            )
            self.assertIn('page: this.pageNum', client)
            self.assertIn('pageSize: this.pageSize', client)
