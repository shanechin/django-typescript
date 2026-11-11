from django.conf import settings


def __getattr__(name):
    """
    Read interface settings when they are used.

    Import-time copies ignore ``override_settings`` and any value assigned
    after Django starts.
    """
    if name == 'INTERFACE_PATH':
        return getattr(settings, 'DJANGO_TS_INTERFACE', '')
    if name == 'FIELD_TYPES':
        return getattr(settings, 'DJANGO_TS_FIELD_TYPES', {})
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
