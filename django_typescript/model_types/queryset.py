import typing
import json
from functools import reduce
import operator

from django.db import models
from django.core.paginator import Paginator
from rest_framework.request import Request

from django_typescript.core import types
from django_typescript.core.utils.subset_serializer import subset_serializer


# =================================
# Model Type Query
# ---------------------------------

class ModelTypeQuery(object):

    """
    Helper class for applying list view queries. These queries will be sent by
    `<ModelName>QuerySet` TypeScript class instances. The query structure is
    essentially a simple boolean algebra.

    """

    def __init__(self, filters: dict, exclude: dict, or_: list):
        """

        Parameters
        ----------
        filters :
            A dictionary containing key-values that should be valid keyword arguments
            for Django `QuerySet`'s `.filter()` method. E.g this should work:

                `queryset.filter(**filters)`

        exclude :
            A dictionary containing key-values that should be valid keyword arguments
            for Django `QuerySet`'s `.exclude()` method. E.g this should work:

                `queryset.exclude(**exclude)`
        or_ :
            An optional list whose values are the same as described here - recursive. They are
            to be used to create union of queries.
        """
        self.filters = filters
        self.exclude = exclude
        self.or_ = or_
        self.children: typing.List['ModelTypeQuery'] = list()

        self._make_children()

    @property
    def n_children(self):
        return len(self.children)

    def _make_children(self):
        for data in self.or_:
            self.children.append(ModelTypeQuery(**data))

    def _q(self) -> models.Q:
        filter_q = models.Q(**self.filters)
        if not self.exclude:
            return filter_q
        return filter_q & ~models.Q(**self.exclude)

    def apply_to_queryset(self, queryset: models.QuerySet, use_q=False):
        if self.n_children == 0:
            if not use_q:
                queryset = queryset.filter(**self.filters)
                if self.exclude:
                    queryset = queryset.exclude(**self.exclude)
                return queryset
            return self._q()
        if use_q:
            return self._q()
        queries = [self._q()] + [c.apply_to_queryset(queryset=queryset, use_q=True) for c in self.children]
        return queryset.filter(reduce(operator.or_, queries))


# =================================
# Prefetch Tree Select Related
# ---------------------------------

class PrefetchTreeSelectRelated(object):

    def __init__(self, prefetch_tree: types.PrefetchTree, base_model: types.ModelClass, key_prefix = None):
        self.prefetch_tree = prefetch_tree
        self.base_model = base_model
        self.key_prefix = key_prefix

    def _select_related_key(self, key: str):
        if self.key_prefix:
            return self.key_prefix + "__" + key
        return key

    def select_related(self) -> typing.Union[typing.List[str], None]:
        selected_related = []
        if isinstance(self.prefetch_tree, str):
            try:
                self.base_model._meta.get_field(self.prefetch_tree)
                selected_related.append(self._select_related_key(self.prefetch_tree))
            except models.FieldDoesNotExist:
                pass
        elif isinstance(self.prefetch_tree, list):
            for prefetch_field in self.prefetch_tree:
                try:
                    self.base_model._meta.get_field(prefetch_field)
                    selected_related.append(self._select_related_key(prefetch_field))
                except models.FieldDoesNotExist:
                    pass
        else:
            for k, v in self.prefetch_tree.items():
                model_field = self.base_model._meta.get_field(k)
                prefetch_tree_select_rel = PrefetchTreeSelectRelated(prefetch_tree=v,
                                                                     base_model=model_field.related_model,
                                                                     key_prefix=self._select_related_key(key=k))
                nested_related = prefetch_tree_select_rel.select_related()
                if nested_related:
                    selected_related += nested_related
        if len(selected_related) > 0:
            return selected_related
        return None


# =================================
# Model Type Queryset Builder
# ---------------------------------

def _coerce_int(value, default=None):
    if value is None or value == '':
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def relation_lookup_is_to_many(model: types.ModelClass, lookup: str) -> bool:
    """
    True when a ``select_related``/``prefetch_related`` path crosses a to-many
    relation. Those paths have to use ``prefetch_related``; ``select_related``
    rejects many-to-many and reverse foreign keys.

    """
    current = model
    to_many = False
    for part in lookup.split('__'):
        try:
            field = current._meta.get_field(part)
        except Exception:
            break
        if not getattr(field, 'one_to_one', False) and (
            getattr(field, 'many_to_many', False) or getattr(field, 'one_to_many', False)
        ):
            to_many = True
        related = getattr(field, 'related_model', None)
        if related is None:
            break
        current = related
    return to_many


class ModelTypeQuerysetBuilder(object):

    """
    Class for 'building' querysets based on Request query parameters.

    """

    QUERY_KEY = 'query'
    PREFETCH_KEY = 'prefetch'
    ORDER_BY_KEY = 'order_by'
    DISTINCT_KEY = 'distinct'

    def __init__(self,  model_cls: types.ModelClass, query: ModelTypeQuery=None, order_by: typing.List[str]=None, distinct: typing.List[str]=None,
                 prefetch_trees: typing.List[types.PrefetchTree]= None):
        self.model_cls = model_cls
        self.query = query
        self.order_by = order_by
        self.distinct = distinct
        self.prefetch_trees = prefetch_trees

    @classmethod
    def for_request(cls, request: Request, model_cls: types.ModelClass) -> 'ModelTypeQuerysetBuilder':
        kwargs = {'model_cls': model_cls}
        if cls.QUERY_KEY in request.query_params:
            kwargs['query'] = ModelTypeQuery(**json.loads(request.query_params[cls.QUERY_KEY]))
        order_raw = request.query_params.get(cls.ORDER_BY_KEY)
        if order_raw is None and 'order_on' in request.query_params:
            # Older generated clients sent ``order_on``.
            order_raw = request.query_params.get('order_on')
        if order_raw is not None:
            kwargs['order_by'] = json.loads(order_raw)
        if cls.PREFETCH_KEY in request.query_params:
            kwargs['prefetch_trees'] = json.loads(request.query_params[cls.PREFETCH_KEY])
        if cls.DISTINCT_KEY in request.query_params:
            kwargs['distinct'] = json.loads(request.query_params[cls.DISTINCT_KEY])
        return cls(**kwargs)

    def _flatten_prefetch_tree(self, prefetch_tree: types.PrefetchTree):
        """
        Return a prefetch tree in 'flattened' form, e.g:

            `{'parent': {'grand_parent'}}` -> `parent__grand_parent`

        """

        prefetch_tree_select_rel = PrefetchTreeSelectRelated(base_model=self.model_cls, prefetch_tree=prefetch_tree)
        return prefetch_tree_select_rel.select_related()

    def build_queryset(self, queryset: models.QuerySet) -> models.QuerySet:
        if self.query:
            queryset = self.query.apply_to_queryset(queryset)
        if self.order_by:
            queryset = queryset.order_by(*self.order_by)
        if self.distinct:
            queryset = queryset.distinct(*self.distinct)
        if self.prefetch_trees:
            select_related = []
            prefetch_related = []
            for prefetch_tree in self.prefetch_trees:
                tree_select_related = self._flatten_prefetch_tree(prefetch_tree=prefetch_tree)
                if tree_select_related is None:
                    continue
                for key in tree_select_related:
                    if key is None:
                        continue
                    if relation_lookup_is_to_many(self.model_cls, key):
                        prefetch_related.append(key)
                    else:
                        select_related.append(key)
            if select_related:
                queryset = queryset.select_related(*select_related)
            if prefetch_related:
                queryset = queryset.prefetch_related(*prefetch_related)
        return queryset


# =================================
# Model Type Queryset Payload Builder
# ---------------------------------

class ModelTypeQuerysetPayloadBuilder(object):

    PAGE_NUM_KEY = 'page'
    PAGE_SIZE_KEY = 'pageSize'
    DEFAULT_PAGE_SIZE = 25
    VALUES_KEY = 'values'
    EXISTS_KEY = 'exists'
    COUNT_KEY = 'count'

    def __init__(self, queryset: models.QuerySet, values: typing.List[str] = None, page_num: int = None,
                 page_size: int = None, exists: bool = False, many=True, count: bool = False):
        self.queryset = queryset
        self.values = values
        self.page_num = page_num
        self.page_size = page_size
        self.exists = exists
        self.count = count
        self.many = many

    @property
    def is_paginated(self):
        return self.page_num is not None

    @classmethod
    def for_request(cls, request: Request, queryset: models.QuerySet, many=True) -> 'ModelTypeQuerysetPayloadBuilder':
        page_size = request.query_params.get(cls.PAGE_SIZE_KEY)
        if page_size is None:
            # Older generated clients sent ``pagesize``.
            page_size = request.query_params.get('pagesize', cls.DEFAULT_PAGE_SIZE)
        kwargs = {
            'page_num': _coerce_int(request.query_params.get(cls.PAGE_NUM_KEY)),
            'page_size': _coerce_int(page_size, cls.DEFAULT_PAGE_SIZE),
        }
        if cls.VALUES_KEY in request.query_params:
            kwargs['values'] = json.loads(request.query_params[cls.VALUES_KEY])
        if cls.EXISTS_KEY in request.query_params:
            kwargs['exists'] = json.loads(request.query_params[cls.EXISTS_KEY])
        if cls.COUNT_KEY in request.query_params:
            kwargs['count'] = json.loads(request.query_params[cls.COUNT_KEY])
        return cls(queryset=queryset, many=many, **kwargs)

    def paginated_payload(self, serializer_cls: types.ModelSerializerClass):
        assert self.is_paginated, 'Payload is not paginated.'
        queryset = self.queryset
        if not queryset.ordered:
            queryset = queryset.order_by('pk')
        if self.values:
            queryset = queryset.values(*self.values)
            serializer_cls = subset_serializer(serializer_cls=serializer_cls, select_fields=self.values)
        paginator = Paginator(queryset, self.page_size)
        queryset = paginator.get_page(number=self.page_num)
        serializer = serializer_cls(queryset, many=self.many)
        return {
            'num_results': paginator.count,
            'num_pages': paginator.num_pages,
            'page': self.page_num,
            'data': serializer.data
        }

    def exists_payload(self):
        assert self.exists, 'Payload is not existence check.'
        return self.queryset.exists()

    def payload(self, serializer_cls: types.ModelSerializerClass):
        if self.values:
            serializer_cls = subset_serializer(serializer_cls=serializer_cls, select_fields=self.values)
        if self.is_paginated:
            return self.paginated_payload(serializer_cls=serializer_cls)
        if self.exists:
            return self.queryset.exists()
        if self.count:
            return self.queryset.count()
        queryset = self.queryset
        if self.values:
            queryset = queryset.values(*self.values)
        serializer = serializer_cls(queryset, many=self.many)
        return serializer.data










