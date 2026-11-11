"""Generate a sample TypeScript client for compilation checks."""

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def configure_django():
    import django
    from django.conf import settings

    if settings.configured:
        return
    settings.configure(
        DEBUG=True,
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
        SECRET_KEY='not very secret',
        USE_I18N=True,
        DEFAULT_AUTO_FIELD='django.db.models.BigAutoField',
        ALLOWED_HOSTS=['*'],
        ROOT_URLCONF='tests.generate_client',
        INSTALLED_APPS=(
            'django.contrib.auth',
            'django.contrib.contenttypes',
            'django.contrib.sites',
            'rest_framework',
            'django_typescript',
            'tests',
        ),
        SITE_ID=1,
    )
    django.setup()


def build_interface(destination: pathlib.Path):
    from rest_framework import serializers

    from django_typescript import interface
    from django_typescript.transpile import Transpiler
    from tests.models import Article, Tag, Thing

    class ThingType(interface.ModelType, model_cls=Thing):

        @interface.ModelType.method()
        def hinted(self, count: int, label: str = 'item'):
            return {'count': count, 'label': label}

    class TagType(interface.ModelType, model_cls=Tag):
        pass

    class ArticleType(interface.ModelType, model_cls=Article):

        @interface.ModelType.method(count=serializers.CharField())
        def mixed(self, count: int, extra: bool):
            return {'count': count, 'extra': extra}

    class NoteSerializer(serializers.Serializer):
        name = serializers.CharField()

    class NoteType(interface.ObjectType, serializer_cls=NoteSerializer):

        def __init__(self, name):
            self.name = name

        @interface.ObjectType.method()
        def shift(self, hours: int, label: str = 'x'):
            return hours

    class LocalInterface(interface.Interface, transpile_dest=destination):
        things = ThingType.as_type()
        tags = TagType.as_type()
        articles = ArticleType.as_type()
        notes = NoteType

    Transpiler(interface=LocalInterface).transpile()


TSCONFIG = """{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "strict": false,
    "skipLibCheck": true,
    "outDir": "build",
    "rootDir": "server",
    "lib": ["ES2020"]
  },
  "include": ["server/**/*.ts"]
}
"""


def main(argv):
    if len(argv) != 2:
        raise SystemExit('usage: python tests/generate_client.py DEST')
    destination = pathlib.Path(argv[1]).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    configure_django()
    build_interface(destination)
    (destination / 'tsconfig.json').write_text(TSCONFIG)


if __name__ == '__main__':
    main(sys.argv)
