
/*<
// -------------------------
// {{ queryset_name }}
//
// -------------------------
>*/


export type __$prefetch_type_name__ = '{{ prefetch_type }}'


export interface __$lookups_interface_name__ {
    /*<{{ queryset_lookups }}>*/
}

export class __$queryset_name__{

    protected lookups: __$lookups_interface_name__;
    protected excludedLookups: __$lookups_interface_name__;
    protected _or: __$queryset_name__[] = [];
    protected _prefetch: __$prefetch_type_name__[];
    protected _orderBy?: string[];
    protected _distinct?: Array<keyof __$field_interface_name__>;
    protected _valuesFields?: Array<keyof __$field_interface_name__>;
    protected _exists?: boolean;
    protected  _count?: boolean;

    constructor(lookups: __$lookups_interface_name__ = {}, excludedLookups: __$lookups_interface_name__ = {}){
        this.lookups = lookups;
        this.excludedLookups = excludedLookups;
    }

    public clone(): __$queryset_name__{
        const clone = new __$queryset_name__()
        clone.lookups = this.lookups;
        clone._prefetch = this._prefetch;
        clone._orderBy = this._orderBy;
        clone._or = JSON.parse(JSON.stringify(this._or));
        clone.excludedLookups = this.excludedLookups;
        return clone;
    }

    public serializeQuery(): object{
        return {
            filters: flattenLookups(this.lookups),
            exclude: flattenLookups(this.excludedLookups),
            or_: this._or.map((queryset) => queryset.serializeQuery())
        }
    }

    public prefetch(...prefetchKeys: __$prefetch_type_name__[]): this{
        const existingPrefetch: __$prefetch_type_name__[] = this._prefetch ? (this._prefetch) : ([] as __$prefetch_type_name__[]);
        this._prefetch = [...existingPrefetch, ...prefetchKeys];
        return this
    }

    public static all(): __$queryset_name__{
        return new __$queryset_name__()
    }

    public static filter(lookups: Partial<__$lookups_interface_name__>): __$queryset_name__{
        return new __$queryset_name__(lookups)
    }

    public filter(lookups: Partial<__$lookups_interface_name__>): __$queryset_name__{
        const clone = this.clone();
        clone.lookups = _.merge(clone.lookups, lookups);
        return clone
    }

     public static exclude(lookups: Partial<__$lookups_interface_name__>): __$queryset_name__{
        return new __$queryset_name__({}, lookups)
    }

    public exclude(lookups: Partial<__$lookups_interface_name__>): __$queryset_name__{
        return new __$queryset_name__(this.lookups, {...this.excludedLookups, ...lookups})
    }

     public or(queryset: __$queryset_name__): this{
        this._or.push(queryset);
        return this
    }

    public static async get(primaryKey: __$pk_type__, ...prefetchKeys: __$prefetch_type_name__[]): Promise<ServerPayload<__$model_name__>>{
        let urlQuery = '';
        if (prefetchKeys){
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.get(`'{{ get_url }}'`, urlQuery);
        if (statusCode === 200){
            return [new __$model_name__(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async getOrCreate(lookup:Partial<__$field_interface_name__>,  defaults: Partial<__$field_interface_name__> = {}, ...prefetchKeys: __$prefetch_type_name__[]): Promise<ServerPayload<[__$model_name__, boolean]>>{
        const data = {lookup, defaults};
         let urlQuery = '';
        if (prefetchKeys){
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.post(`'{{ get_or_create_url }}'`, data, urlQuery);

        if (statusCode === 201){
            return [[new __$model_name__(responseData), true], responseData, statusCode, err]
        }
        if (statusCode === 200){
            return [[new __$model_name__(responseData), false], responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async create(data: Partial<__$field_interface_name__>): Promise<ServerPayload<__$model_name__>>{
        let [responseData, statusCode, err] = await serverClient.post(`'{{ create_url }}'`, data);

        if (statusCode === 201){
            return [new __$model_name__(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async values(...fields: Array<keyof __$field_interface_name__>): Promise<ServerDataPayload<QuerysetValuesList<__$field_interface_name__>>>{
        this._valuesFields = fields;
        return await this._retrieve();
    }

    public async pageValues(pageNum: number = 1, pageSize: number = 25, ...fields: Array<keyof __$field_interface_name__>): Promise<ServerDataPayload<PaginatedData<QuerysetValuesList<__$field_interface_name__>>>>{
        this._valuesFields = fields;
        return await this._retrieve(pageNum, pageSize);
    }

    public order_by(...fields: ModelFieldOrdering<__$field_interface_name__>[]): this{
        this._orderBy = fields.map((fieldOrdering) => typeof fieldOrdering === 'string' ? (fieldOrdering) : (fieldOrdering.join('')));
        return this
    }

    public distinct(...fields:Array<keyof __$field_interface_name__>): this{
        this._distinct = fields;
        return this
    }

    public async retrieve(): Promise<ServerPayload<__$model_name__[]>>{
        let [responseData, statusCode, err] = await this._retrieve();

        if (statusCode in SuccessfulHttpStatusCodes){
            return [responseData.map((data) => new __$model_name__(data)), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async retrievePage(pageNum: number = 1, pageSize: number = 25): Promise<ServerPayload<PaginatedData<__$model_name__>>>{
        let [responseData, statusCode, err] = await this._retrieve(pageNum, pageSize);

        if (statusCode in SuccessfulHttpStatusCodes){
            return [{
            ...responseData,
            data: responseData.data.map((data) => new __$model_name__(data) )
        }, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async exists(): Promise<ServerPayload<boolean>>{
        this._exists = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes){
            return [responseData, responseData, statusCode, err]
        }
         return [undefined, responseData, statusCode, err]
    }

    public async count(): Promise<ServerPayload<number>>{
        this._count = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes){
            return [responseData, responseData, statusCode, err]
        }
         return [undefined, responseData, statusCode, err]
    }

    private async _retrieve(pageNum?: number, pageSize?: number): Promise<ServerResponse>{
        const urlQuery = buildUrlQuery({
            query: JSON.stringify(this.serializeQuery()),
            prefetch: this._prefetch ? JSON.stringify(this._prefetch) : undefined,
            order_by: this._orderBy ? JSON.stringify(this._orderBy) : undefined,
            distinct: this._distinct ? JSON.stringify(this._distinct) : undefined,
            exists: this._exists ? JSON.stringify(true) : undefined,
            count: this._count ? JSON.stringify(true) : undefined,
            values: this._valuesFields ? JSON.stringify(this._valuesFields) : undefined,
            page: pageNum,
            pageSize: pageSize,
        });
        let [responseData, statusCode, err] = await serverClient.get(`'{{ list_url}}'`, urlQuery);
        return [responseData, statusCode, err]
    }

}



/*<
// -------------------------
// {{ model_name }}
//
// -------------------------
>*/


export interface __$field_interface_name__ {
    /*<{{ model_interface_types }}>*/
}


export class __$model_name__ implements __$field_interface_name__{

    /*<{{ model_class_types }}>*/
    private static _makeDetailLink?: (pk: __$pk_type__) => string;

    public static readonly FIELD_SCHEMAS: ModelFieldsSchema<FieldType> = {
         /*<{{ field_schemas }}>*/
    }

    constructor(data: __$field_interface_name__){
        Object.assign(this, data);
    }

    static objects = __$queryset_name__;

    public pk(): __$pk_type__{
        /*< return  this.{{ pk_field_name }}  >*/
    }

    public toJSON(){
        return this.pk()
    }

    public fieldData(): __$field_interface_name__{
        let fieldData = {}
        Object.keys(__$model_name__.FIELD_SCHEMAS).map((fieldName) => fieldData[fieldName] = this[fieldName])
        return fieldData as __$field_interface_name__
    }

    public static setDetailLink(makeDetailLink: (pk: __$pk_type__) => string){
        __$model_name__._makeDetailLink = makeDetailLink;
    }

    public detailLink(): string | undefined{
        if (__$model_name__._makeDetailLink){
            return __$model_name__._makeDetailLink(this.pk())
        }
        return undefined
    }

    public async refresh(...prefetchKeys: __$prefetch_type_name__[]){
        return __$queryset_name__.get(this.pk(), ...prefetchKeys)
    }

    public async update(data: Partial<__$field_interface_name__>, ...prefetchKeys: __$prefetch_type_name__[]): Promise<ServerPayload<__$model_name__>>{
        let urlQuery = "";
        if (prefetchKeys){urlQuery += "&prefetch=" + JSON.stringify(prefetchKeys)}
        let [responseData, statusCode, err] = await serverClient.post(`'{{ update_url}}'`, data, urlQuery);
         if (statusCode in SuccessfulHttpStatusCodes){
            return [new __$model_name__(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err];
    }

    public async delete(){
        return await serverClient.delete(`'{{ delete_url }}'`);
    }

     /*<{% for reverse_relation in reverse_relations %}
      public {{ reverse_relation.name }}(lookups: {{ reverse_relation.lookups_type }} = {}){
           return new {{ reverse_relation.queryset_name }}({...lookups, ...{ {{ reverse_relation.lookup_key }}}})
      }
      {% endfor %}>*/

     /*<{% for method in methods %}
      public async {{ method.name }}({{ method.sig_interface }}){
           return await serverClient.post(`{{ method.url}}`, {{ 'data' if method.sig_interface else '{}' }});
      }
      {% endfor %}>*/

     /*<{% for static_method in static_methods %}
      public static async {{ static_method.name }}({{ static_method.sig_interface }}){
           return await serverClient.post(`{{ static_method.url}}`, {{ 'data' if static_method.sig_interface else '{}' }});
      }
      {% endfor %}>*/


}