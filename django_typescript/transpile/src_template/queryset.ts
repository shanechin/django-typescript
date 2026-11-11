



class __$queryset_name__{

    protected lookups: __$lookups_interface_name__;
    protected excludedLookups: __$lookups_interface_name__;
    protected _or: __$queryset_name__[] = [];
    protected _prefetch: __$prefetch_type_name__[];
    protected _orderBy?: string[];
    protected _distinct?: Array<[keyof __$field_interface_name__]>;
    protected _valuesFields?: Array<[keyof __$field_interface_name__]>;

    constructor(lookups: __$lookups_interface_name__ = {}, excludedLookups: __$lookups_interface_name__ = {}){
        this.lookups = lookups;
        this.excludedLookups = excludedLookups;
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
        return new __$queryset_name__({...this.lookups, ...lookups}, this.excludedLookups)
    }

     public static exclude(lookups: Partial<__$lookups_interface_name__>): __$queryset_name__{
        return new __$queryset_name__({}, lookups)
    }

    public exclude(lookups: Partial<__$lookups_interface_name__>): __$queryset_name__{
        return new __$queryset_name__({}, {...this.excludedLookups, ...lookups})
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

    public static async getOrCreate(lookup:Partial<__$field_interface_name__>,  defaults: Partial<__$field_interface_name__> = {}): Promise<ServerPayload<[__$model_name__, boolean]>>{
        const data = {lookup, defaults};
        let [responseData, statusCode, err] = await serverClient.post(`'{{ get_or_create_url }}'`, data);

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

    public async values(...fields: Array<[keyof __$field_interface_name__]>): ServerDataPayload<QuerysetValuesList<__$field_interface_name__>>{
        this._valuesFields = fields;
        return await this._retrieve();
    }

    public async pageValues(pageNum: number = 1, pageSize: number = 25, ...fields: Array<[keyof __$field_interface_name__]>): ServerDataPayload<PaginatedData<QuerysetValuesList<__$field_interface_name__>>>{
        this._valuesFields = fields;
        return await this._retrieve(pageNum, pageSize);
    }

    public order_by(...fields: ModelFieldOrdering<__$field_interface_name__>[]): this{
        this._orderBy = fields.map((fieldOrdering) => typeof fieldOrdering === 'string' ? (fieldOrdering) : (fieldOrdering.join('')));
        return this
    }

    public async retrieve(): Promise<PayloadType>{
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


    private async _retrieve(pageNum?: number, pageSize?: number): Promise<ServerResponse>{
        let urlQuery = "query=" + JSON.stringify(this.serializeQuery());
        if (this._prefetch){urlQuery += "&prefetch=" + JSON.stringify(this._prefetch)}
        if (this._orderBy){urlQuery += "&order_by=" + JSON.stringify(this._orderBy)}
        if (this._distinct){urlQuery += "&distinct=" + JSON.stringify(this._distinct)}
        if (pageNum){urlQuery += "&page=" + pageNum}
        if (pageSize){urlQuery += "&pageSize=" + pageSize}
        let [responseData, statusCode, err] = await serverClient.get(`'{{ list_url}}'`, urlQuery);
        return [responseData, statusCode, err]
    }

}


export class __$model_name__ implements __$field_interface_name__{


}