import * as _ from 'lodash'

import { serverClient } from './client'
import {
    PaginatedData,
    PrimaryKey,
    foreignKeyField,
    propertyField,
    dateTimeField,
    ModelFieldsSchema,
    SuccessfulHttpStatusCodes,
    ServerPayload,
    ServerDataPayload,
    QuerysetValues,
    QuerysetValuesList,
    QuerysetModelList,
    ModelFieldOrdering,
    ServerResponse
} from './core'

export type FieldType = 'DateTimeField' | 'OneToOneField' | 'IntegerField' | 'CharField' | 'ForeignKey' | 'AutoField'



// -------------------------
// Flatten Lookups
//
// -------------------------

const flattenLookups = function(ob) {
    let toReturn = {};
    if (Array.isArray(ob)) { return ob }
    for (let i in ob) {
        if (Array.isArray(ob[i])) {
            toReturn[i] = ob[i];
            continue
        }
        if (!ob.hasOwnProperty(i)) { continue }

        if ((typeof ob[i]) === 'object') {
            let flatObject = flattenLookups(ob[i]);
            for (let x in flatObject) {

                if (!flatObject.hasOwnProperty(x)) { continue }

                toReturn[i + '__' + x] = flatObject[x];
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
};


// -------------------------
// ThingQuerySet
//
// -------------------------


export type ThingPrefetchKey = 'one_to_one_target' | { one_to_one_target: ThingOneToOneTargetPrefetchKey | ThingOneToOneTargetPrefetchKey[] }


export interface ThingQuerySetLookups {
    id?: number
    id__exact?: number
    id__iexact?: number
    id__gt?: number
    id__gte?: number
    id__lt?: number
    id__lte?: number
    id__in?: number[]
    id__contains?: number
    id__icontains?: number
    id__startswith?: number
    id__istartswith?: number
    id__endswith?: number
    id__iendswith?: number
    id__range?: [number, number]
    id__isnull?: boolean
    id__regex?: number
    id__iregex?: number
    name?: string
    name__exact?: string
    name__iexact?: string
    name__gt?: string
    name__gte?: string
    name__lt?: string
    name__lte?: string
    name__in?: string[]
    name__contains?: string
    name__icontains?: string
    name__startswith?: string
    name__istartswith?: string
    name__endswith?: string
    name__iendswith?: string
    name__range?: [string, string]
    name__isnull?: boolean
    name__regex?: string
    name__iregex?: string
    number?: number
    number__exact?: number
    number__iexact?: number
    number__gt?: number
    number__gte?: number
    number__lt?: number
    number__lte?: number
    number__in?: number[]
    number__contains?: number
    number__icontains?: number
    number__startswith?: number
    number__istartswith?: number
    number__endswith?: number
    number__iendswith?: number
    number__range?: [number, number]
    number__isnull?: boolean
    number__regex?: number
    number__iregex?: number
    one_to_one_target?: ThingOneToOneTargetQuerySetLookups
    children?: ThingChildQuerySetLookups
}

export class ThingQuerySet {

    protected lookups: ThingQuerySetLookups;
    protected excludedLookups: ThingQuerySetLookups;
    protected _or: ThingQuerySet[] = [];
    protected _prefetch: ThingPrefetchKey[];
    protected _orderBy?: string[];
    protected _distinct?: Array<keyof ThingFields>;
    protected _valuesFields?: Array<keyof ThingFields>;
    protected _exists?: boolean;
    protected _count?: boolean;

    constructor(lookups: ThingQuerySetLookups = {}, excludedLookups: ThingQuerySetLookups = {}) {
        this.lookups = lookups;
        this.excludedLookups = excludedLookups;
    }

    public clone(): ThingQuerySet {
        const clone = new ThingQuerySet()
        clone.lookups = this.lookups;
        clone._prefetch = this._prefetch;
        clone._orderBy = this._orderBy;
        clone._or = JSON.parse(JSON.stringify(this._or));
        clone.excludedLookups = this.excludedLookups;
        return clone;
    }

    public serializeQuery(): object {
        return {
            filters: flattenLookups(this.lookups),
            exclude: flattenLookups(this.excludedLookups),
            or_: this._or.map((queryset) => queryset.serializeQuery())
        }
    }

    public prefetch(...prefetchKeys: ThingPrefetchKey[]): this {
        const existingPrefetch: ThingPrefetchKey[] = this._prefetch ? (this._prefetch) : ([] as ThingPrefetchKey[]);
        this._prefetch = [...existingPrefetch, ...prefetchKeys];
        return this
    }

    public static all(): ThingQuerySet {
        return new ThingQuerySet()
    }

    public static filter(lookups: Partial<ThingQuerySetLookups>): ThingQuerySet {
        return new ThingQuerySet(lookups)
    }

    public filter(lookups: Partial<ThingQuerySetLookups>): ThingQuerySet {
        const clone = this.clone();
        clone.lookups = _.merge(clone.lookups, lookups);
        return clone
    }

    public static exclude(lookups: Partial<ThingQuerySetLookups>): ThingQuerySet {
        return new ThingQuerySet({}, lookups)
    }

    public exclude(lookups: Partial<ThingQuerySetLookups>): ThingQuerySet {
        return new ThingQuerySet(this.lookups, { ...this.excludedLookups, ...lookups })
    }

    public or(queryset: ThingQuerySet): this {
        this._or.push(queryset);
        return this
    }

    public static async get(primaryKey: number, ...prefetchKeys: ThingPrefetchKey[]): Promise<ServerPayload<Thing>> {
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.get(`thing/${primaryKey}/get/`, urlQuery);
        if (statusCode === 200) {
            return [new Thing(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async getOrCreate(lookup: Partial<ThingFields>, defaults: Partial<ThingFields> = {}, ...prefetchKeys: ThingPrefetchKey[]): Promise<ServerPayload<[Thing, boolean]>> {
        const data = { lookup, defaults };
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.post(`thing/get-or-create/`, data, urlQuery);

        if (statusCode === 201) {
            return [[new Thing(responseData), true], responseData, statusCode, err]
        }
        if (statusCode === 200) {
            return [[new Thing(responseData), false], responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async create(data: Partial<ThingFields>): Promise<ServerPayload<Thing>> {
        let [responseData, statusCode, err] = await serverClient.post(`thing/create/`, data);

        if (statusCode === 201) {
            return [new Thing(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async values(...fields: Array<keyof ThingFields>): Promise<ServerDataPayload<QuerysetValuesList<ThingFields>>> {
        this._valuesFields = fields;
        return await this._retrieve();
    }

    public async pageValues(pageNum: number = 1, pageSize: number = 25, ...fields: Array<keyof ThingFields>): Promise<ServerDataPayload<PaginatedData<QuerysetValuesList<ThingFields>>>> {
        this._valuesFields = fields;
        return await this._retrieve(pageNum, pageSize);
    }

    public order_by(...fields: ModelFieldOrdering<ThingFields>[]): this {
        this._orderBy = fields.map((fieldOrdering) => typeof fieldOrdering === 'string' ? (fieldOrdering) : (fieldOrdering.join('')));
        return this
    }

    public distinct(...fields: Array<keyof ThingFields>): this {
        this._distinct = fields;
        return this
    }

    public async retrieve(): Promise<ServerPayload<Thing[]>> {
        let [responseData, statusCode, err] = await this._retrieve();

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData.map((data) => new Thing(data)), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async retrievePage(pageNum: number = 1, pageSize: number = 25): Promise<ServerPayload<PaginatedData<Thing>>> {
        let [responseData, statusCode, err] = await this._retrieve(pageNum, pageSize);

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [{
                ...responseData,
                data: responseData.data.map((data) => new Thing(data))
            }, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async exists(): Promise<ServerPayload<boolean>> {
        this._exists = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async count(): Promise<ServerPayload<number>> {
        this._count = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    private async _retrieve(pageNum?: number, pageSize?: number): Promise<ServerResponse> {
        let urlQuery = "query=" + JSON.stringify(this.serializeQuery());
        if (this._prefetch) { urlQuery += "&prefetch=" + JSON.stringify(this._prefetch) }
        if (this._orderBy) { urlQuery += "&order_by=" + JSON.stringify(this._orderBy) }
        if (this._distinct) { urlQuery += "&distinct=" + JSON.stringify(this._distinct) }
        if (this._exists) { urlQuery += "&exists=" + JSON.stringify(true) }
        if (this._count) { urlQuery += "&count=" + JSON.stringify(true) }
        if (this._valuesFields) { urlQuery += "&values=" + JSON.stringify(this._valuesFields) }
        if (pageNum) { urlQuery += "&page=" + pageNum }
        if (pageSize) { urlQuery += "&pageSize=" + pageSize }
        let [responseData, statusCode, err] = await serverClient.get(`thing/`, urlQuery);
        return [responseData, statusCode, err]
    }

}



// -------------------------
// Thing
//
// -------------------------


export interface ThingFields {
    readonly id: number
    name?: string
    number?: number
}


export class Thing implements ThingFields {

    readonly id: number
    name?: string
    number?: number
    @foreignKeyField(() => ThingOneToOneTarget) one_to_one_target?: ThingOneToOneTarget
    private static _makeDetailLink?: (pk: number) => string;

    public static readonly FIELD_SCHEMAS: ModelFieldsSchema<FieldType> = {
        id: { fieldName: 'id', fieldType: 'AutoField', nullable: false, isReadOnly: true, description: null },
        name: { fieldName: 'name', fieldType: 'CharField', nullable: true, isReadOnly: false, description: null },
        number: { fieldName: 'number', fieldType: 'IntegerField', nullable: true, isReadOnly: false, description: null }
    }

    constructor(data: ThingFields) {
        Object.assign(this, data);
    }

    static objects = ThingQuerySet;

    public pk(): number {
        return this.id
    }

    public toJSON() {
        return this.pk()
    }

    public fieldData(): ThingFields {
        let fieldData = {}
        Object.keys(Thing.FIELD_SCHEMAS).map((fieldName) => fieldData[fieldName] = this[fieldName])
        return fieldData as ThingFields
    }

    public static setDetailLink(makeDetailLink: (pk: number) => string) {
        Thing._makeDetailLink = makeDetailLink;
    }

    public detailLink(): string | undefined {
        if (Thing._makeDetailLink) {
            return Thing._makeDetailLink(this.pk())
        }
        return undefined
    }

    public async refresh(...prefetchKeys: ThingPrefetchKey[]) {
        return ThingQuerySet.get(this.pk(), ...prefetchKeys)
    }

    public async update(data: Partial<ThingFields>, ...prefetchKeys: ThingPrefetchKey[]): Promise<ServerPayload<Thing>> {
        let urlQuery = "";
        if (prefetchKeys) { urlQuery += "&prefetch=" + JSON.stringify(prefetchKeys) }
        let [responseData, statusCode, err] = await serverClient.post(`thing/${this.pk()}/update/`, data, urlQuery);
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [new Thing(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err];
    }

    public async delete() {
        return await serverClient.delete(`thing/${this.pk()}/delete/`);
    }

    public children(lookups: ThingChildQuerySetLookups = {}) {
        return new ThingChildQuerySet({ ...lookups, ...{ parent: { id: this.pk() } } })
    }


    public async thing_method(data: { a: string, b: string }) {
        return await serverClient.post(`thing/thing-method/${this.pk()}/`, data);
    }


    public static async thing_static_method(data: { a: string, b: string }) {
        return await serverClient.post(`thing/thing-static-method/`, data);
    }



}

// -------------------------
// ThingOneToOneTargetQuerySet
//
// -------------------------


export type ThingOneToOneTargetPrefetchKey = 'sibling_thing' | { sibling_thing: ThingPrefetchKey | ThingPrefetchKey[] }


export interface ThingOneToOneTargetQuerySetLookups {
    id?: number
    id__exact?: number
    id__iexact?: number
    id__gt?: number
    id__gte?: number
    id__lt?: number
    id__lte?: number
    id__in?: number[]
    id__contains?: number
    id__icontains?: number
    id__startswith?: number
    id__istartswith?: number
    id__endswith?: number
    id__iendswith?: number
    id__range?: [number, number]
    id__isnull?: boolean
    id__regex?: number
    id__iregex?: number
    sibling_thing_id?: number
    sibling_thing?: ThingQuerySetLookups
}

export class ThingOneToOneTargetQuerySet {

    protected lookups: ThingOneToOneTargetQuerySetLookups;
    protected excludedLookups: ThingOneToOneTargetQuerySetLookups;
    protected _or: ThingOneToOneTargetQuerySet[] = [];
    protected _prefetch: ThingOneToOneTargetPrefetchKey[];
    protected _orderBy?: string[];
    protected _distinct?: Array<keyof ThingOneToOneTargetFields>;
    protected _valuesFields?: Array<keyof ThingOneToOneTargetFields>;
    protected _exists?: boolean;
    protected _count?: boolean;

    constructor(lookups: ThingOneToOneTargetQuerySetLookups = {}, excludedLookups: ThingOneToOneTargetQuerySetLookups = {}) {
        this.lookups = lookups;
        this.excludedLookups = excludedLookups;
    }

    public clone(): ThingOneToOneTargetQuerySet {
        const clone = new ThingOneToOneTargetQuerySet()
        clone.lookups = this.lookups;
        clone._prefetch = this._prefetch;
        clone._orderBy = this._orderBy;
        clone._or = JSON.parse(JSON.stringify(this._or));
        clone.excludedLookups = this.excludedLookups;
        return clone;
    }

    public serializeQuery(): object {
        return {
            filters: flattenLookups(this.lookups),
            exclude: flattenLookups(this.excludedLookups),
            or_: this._or.map((queryset) => queryset.serializeQuery())
        }
    }

    public prefetch(...prefetchKeys: ThingOneToOneTargetPrefetchKey[]): this {
        const existingPrefetch: ThingOneToOneTargetPrefetchKey[] = this._prefetch ? (this._prefetch) : ([] as ThingOneToOneTargetPrefetchKey[]);
        this._prefetch = [...existingPrefetch, ...prefetchKeys];
        return this
    }

    public static all(): ThingOneToOneTargetQuerySet {
        return new ThingOneToOneTargetQuerySet()
    }

    public static filter(lookups: Partial<ThingOneToOneTargetQuerySetLookups>): ThingOneToOneTargetQuerySet {
        return new ThingOneToOneTargetQuerySet(lookups)
    }

    public filter(lookups: Partial<ThingOneToOneTargetQuerySetLookups>): ThingOneToOneTargetQuerySet {
        const clone = this.clone();
        clone.lookups = _.merge(clone.lookups, lookups);
        return clone
    }

    public static exclude(lookups: Partial<ThingOneToOneTargetQuerySetLookups>): ThingOneToOneTargetQuerySet {
        return new ThingOneToOneTargetQuerySet({}, lookups)
    }

    public exclude(lookups: Partial<ThingOneToOneTargetQuerySetLookups>): ThingOneToOneTargetQuerySet {
        return new ThingOneToOneTargetQuerySet(this.lookups, { ...this.excludedLookups, ...lookups })
    }

    public or(queryset: ThingOneToOneTargetQuerySet): this {
        this._or.push(queryset);
        return this
    }

    public static async get(primaryKey: number, ...prefetchKeys: ThingOneToOneTargetPrefetchKey[]): Promise<ServerPayload<ThingOneToOneTarget>> {
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.get(`thing-one-to-one-target/${primaryKey}/get/`, urlQuery);
        if (statusCode === 200) {
            return [new ThingOneToOneTarget(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async getOrCreate(lookup: Partial<ThingOneToOneTargetFields>, defaults: Partial<ThingOneToOneTargetFields> = {}, ...prefetchKeys: ThingOneToOneTargetPrefetchKey[]): Promise<ServerPayload<[ThingOneToOneTarget, boolean]>> {
        const data = { lookup, defaults };
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.post(`thing-one-to-one-target/get-or-create/`, data, urlQuery);

        if (statusCode === 201) {
            return [[new ThingOneToOneTarget(responseData), true], responseData, statusCode, err]
        }
        if (statusCode === 200) {
            return [[new ThingOneToOneTarget(responseData), false], responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async create(data: Partial<ThingOneToOneTargetFields>): Promise<ServerPayload<ThingOneToOneTarget>> {
        let [responseData, statusCode, err] = await serverClient.post(`thing-one-to-one-target/create/`, data);

        if (statusCode === 201) {
            return [new ThingOneToOneTarget(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async values(...fields: Array<keyof ThingOneToOneTargetFields>): Promise<ServerDataPayload<QuerysetValuesList<ThingOneToOneTargetFields>>> {
        this._valuesFields = fields;
        return await this._retrieve();
    }

    public async pageValues(pageNum: number = 1, pageSize: number = 25, ...fields: Array<keyof ThingOneToOneTargetFields>): Promise<ServerDataPayload<PaginatedData<QuerysetValuesList<ThingOneToOneTargetFields>>>> {
        this._valuesFields = fields;
        return await this._retrieve(pageNum, pageSize);
    }

    public order_by(...fields: ModelFieldOrdering<ThingOneToOneTargetFields>[]): this {
        this._orderBy = fields.map((fieldOrdering) => typeof fieldOrdering === 'string' ? (fieldOrdering) : (fieldOrdering.join('')));
        return this
    }

    public distinct(...fields: Array<keyof ThingOneToOneTargetFields>): this {
        this._distinct = fields;
        return this
    }

    public async retrieve(): Promise<ServerPayload<ThingOneToOneTarget[]>> {
        let [responseData, statusCode, err] = await this._retrieve();

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData.map((data) => new ThingOneToOneTarget(data)), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async retrievePage(pageNum: number = 1, pageSize: number = 25): Promise<ServerPayload<PaginatedData<ThingOneToOneTarget>>> {
        let [responseData, statusCode, err] = await this._retrieve(pageNum, pageSize);

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [{
                ...responseData,
                data: responseData.data.map((data) => new ThingOneToOneTarget(data))
            }, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async exists(): Promise<ServerPayload<boolean>> {
        this._exists = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async count(): Promise<ServerPayload<number>> {
        this._count = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    private async _retrieve(pageNum?: number, pageSize?: number): Promise<ServerResponse> {
        let urlQuery = "query=" + JSON.stringify(this.serializeQuery());
        if (this._prefetch) { urlQuery += "&prefetch=" + JSON.stringify(this._prefetch) }
        if (this._orderBy) { urlQuery += "&order_by=" + JSON.stringify(this._orderBy) }
        if (this._distinct) { urlQuery += "&distinct=" + JSON.stringify(this._distinct) }
        if (this._exists) { urlQuery += "&exists=" + JSON.stringify(true) }
        if (this._count) { urlQuery += "&count=" + JSON.stringify(true) }
        if (this._valuesFields) { urlQuery += "&values=" + JSON.stringify(this._valuesFields) }
        if (pageNum) { urlQuery += "&page=" + pageNum }
        if (pageSize) { urlQuery += "&pageSize=" + pageSize }
        let [responseData, statusCode, err] = await serverClient.get(`thing-one-to-one-target/`, urlQuery);
        return [responseData, statusCode, err]
    }

}



// -------------------------
// ThingOneToOneTarget
//
// -------------------------


export interface ThingOneToOneTargetFields {
    readonly id: number
    sibling_thing_id: number
}


export class ThingOneToOneTarget implements ThingOneToOneTargetFields {

    readonly id: number
    sibling_thing_id: number
    @foreignKeyField(() => Thing) sibling_thing?: Thing
    private static _makeDetailLink?: (pk: number) => string;

    public static readonly FIELD_SCHEMAS: ModelFieldsSchema<FieldType> = {
        id: { fieldName: 'id', fieldType: 'AutoField', nullable: false, isReadOnly: true, description: null },
        sibling_thing_id: { fieldName: 'sibling_thing_id', fieldType: 'IntegerField', nullable: false, isReadOnly: false, relatedModel: () => Thing }
    }

    constructor(data: ThingOneToOneTargetFields) {
        Object.assign(this, data);
    }

    static objects = ThingOneToOneTargetQuerySet;

    public pk(): number {
        return this.id
    }

    public toJSON() {
        return this.pk()
    }

    public fieldData(): ThingOneToOneTargetFields {
        let fieldData = {}
        Object.keys(ThingOneToOneTarget.FIELD_SCHEMAS).map((fieldName) => fieldData[fieldName] = this[fieldName])
        return fieldData as ThingOneToOneTargetFields
    }

    public static setDetailLink(makeDetailLink: (pk: number) => string) {
        ThingOneToOneTarget._makeDetailLink = makeDetailLink;
    }

    public detailLink(): string | undefined {
        if (ThingOneToOneTarget._makeDetailLink) {
            return ThingOneToOneTarget._makeDetailLink(this.pk())
        }
        return undefined
    }

    public async refresh(...prefetchKeys: ThingOneToOneTargetPrefetchKey[]) {
        return ThingOneToOneTargetQuerySet.get(this.pk(), ...prefetchKeys)
    }

    public async update(data: Partial<ThingOneToOneTargetFields>, ...prefetchKeys: ThingOneToOneTargetPrefetchKey[]): Promise<ServerPayload<ThingOneToOneTarget>> {
        let urlQuery = "";
        if (prefetchKeys) { urlQuery += "&prefetch=" + JSON.stringify(prefetchKeys) }
        let [responseData, statusCode, err] = await serverClient.post(`thing-one-to-one-target/${this.pk()}/update/`, data, urlQuery);
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [new ThingOneToOneTarget(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err];
    }

    public async delete() {
        return await serverClient.delete(`thing-one-to-one-target/${this.pk()}/delete/`);
    }








}

// -------------------------
// ThingChildQuerySet
//
// -------------------------


export type ThingChildPrefetchKey = 'parent' | { parent: ThingPrefetchKey | ThingPrefetchKey[] }


export interface ThingChildQuerySetLookups {
    id?: number
    id__exact?: number
    id__iexact?: number
    id__gt?: number
    id__gte?: number
    id__lt?: number
    id__lte?: number
    id__in?: number[]
    id__contains?: number
    id__icontains?: number
    id__startswith?: number
    id__istartswith?: number
    id__endswith?: number
    id__iendswith?: number
    id__range?: [number, number]
    id__isnull?: boolean
    id__regex?: number
    id__iregex?: number
    name?: string
    name__exact?: string
    name__iexact?: string
    name__gt?: string
    name__gte?: string
    name__lt?: string
    name__lte?: string
    name__in?: string[]
    name__contains?: string
    name__icontains?: string
    name__startswith?: string
    name__istartswith?: string
    name__endswith?: string
    name__iendswith?: string
    name__range?: [string, string]
    name__isnull?: boolean
    name__regex?: string
    name__iregex?: string
    number?: number
    number__exact?: number
    number__iexact?: number
    number__gt?: number
    number__gte?: number
    number__lt?: number
    number__lte?: number
    number__in?: number[]
    number__contains?: number
    number__icontains?: number
    number__startswith?: number
    number__istartswith?: number
    number__endswith?: number
    number__iendswith?: number
    number__range?: [number, number]
    number__isnull?: boolean
    number__regex?: number
    number__iregex?: number
    parent_id?: number
    parent?: ThingQuerySetLookups
    children?: ThingChildChildQuerySetLookups
}

export class ThingChildQuerySet {

    protected lookups: ThingChildQuerySetLookups;
    protected excludedLookups: ThingChildQuerySetLookups;
    protected _or: ThingChildQuerySet[] = [];
    protected _prefetch: ThingChildPrefetchKey[];
    protected _orderBy?: string[];
    protected _distinct?: Array<keyof ThingChildFields>;
    protected _valuesFields?: Array<keyof ThingChildFields>;
    protected _exists?: boolean;
    protected _count?: boolean;

    constructor(lookups: ThingChildQuerySetLookups = {}, excludedLookups: ThingChildQuerySetLookups = {}) {
        this.lookups = lookups;
        this.excludedLookups = excludedLookups;
    }

    public clone(): ThingChildQuerySet {
        const clone = new ThingChildQuerySet()
        clone.lookups = this.lookups;
        clone._prefetch = this._prefetch;
        clone._orderBy = this._orderBy;
        clone._or = JSON.parse(JSON.stringify(this._or));
        clone.excludedLookups = this.excludedLookups;
        return clone;
    }

    public serializeQuery(): object {
        return {
            filters: flattenLookups(this.lookups),
            exclude: flattenLookups(this.excludedLookups),
            or_: this._or.map((queryset) => queryset.serializeQuery())
        }
    }

    public prefetch(...prefetchKeys: ThingChildPrefetchKey[]): this {
        const existingPrefetch: ThingChildPrefetchKey[] = this._prefetch ? (this._prefetch) : ([] as ThingChildPrefetchKey[]);
        this._prefetch = [...existingPrefetch, ...prefetchKeys];
        return this
    }

    public static all(): ThingChildQuerySet {
        return new ThingChildQuerySet()
    }

    public static filter(lookups: Partial<ThingChildQuerySetLookups>): ThingChildQuerySet {
        return new ThingChildQuerySet(lookups)
    }

    public filter(lookups: Partial<ThingChildQuerySetLookups>): ThingChildQuerySet {
        const clone = this.clone();
        clone.lookups = _.merge(clone.lookups, lookups);
        return clone
    }

    public static exclude(lookups: Partial<ThingChildQuerySetLookups>): ThingChildQuerySet {
        return new ThingChildQuerySet({}, lookups)
    }

    public exclude(lookups: Partial<ThingChildQuerySetLookups>): ThingChildQuerySet {
        return new ThingChildQuerySet(this.lookups, { ...this.excludedLookups, ...lookups })
    }

    public or(queryset: ThingChildQuerySet): this {
        this._or.push(queryset);
        return this
    }

    public static async get(primaryKey: number, ...prefetchKeys: ThingChildPrefetchKey[]): Promise<ServerPayload<ThingChild>> {
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.get(`thing-child/${primaryKey}/get/`, urlQuery);
        if (statusCode === 200) {
            return [new ThingChild(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async getOrCreate(lookup: Partial<ThingChildFields>, defaults: Partial<ThingChildFields> = {}, ...prefetchKeys: ThingChildPrefetchKey[]): Promise<ServerPayload<[ThingChild, boolean]>> {
        const data = { lookup, defaults };
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.post(`thing-child/get-or-create/`, data, urlQuery);

        if (statusCode === 201) {
            return [[new ThingChild(responseData), true], responseData, statusCode, err]
        }
        if (statusCode === 200) {
            return [[new ThingChild(responseData), false], responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async create(data: Partial<ThingChildFields>): Promise<ServerPayload<ThingChild>> {
        let [responseData, statusCode, err] = await serverClient.post(`thing-child/create/`, data);

        if (statusCode === 201) {
            return [new ThingChild(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async values(...fields: Array<keyof ThingChildFields>): Promise<ServerDataPayload<QuerysetValuesList<ThingChildFields>>> {
        this._valuesFields = fields;
        return await this._retrieve();
    }

    public async pageValues(pageNum: number = 1, pageSize: number = 25, ...fields: Array<keyof ThingChildFields>): Promise<ServerDataPayload<PaginatedData<QuerysetValuesList<ThingChildFields>>>> {
        this._valuesFields = fields;
        return await this._retrieve(pageNum, pageSize);
    }

    public order_by(...fields: ModelFieldOrdering<ThingChildFields>[]): this {
        this._orderBy = fields.map((fieldOrdering) => typeof fieldOrdering === 'string' ? (fieldOrdering) : (fieldOrdering.join('')));
        return this
    }

    public distinct(...fields: Array<keyof ThingChildFields>): this {
        this._distinct = fields;
        return this
    }

    public async retrieve(): Promise<ServerPayload<ThingChild[]>> {
        let [responseData, statusCode, err] = await this._retrieve();

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData.map((data) => new ThingChild(data)), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async retrievePage(pageNum: number = 1, pageSize: number = 25): Promise<ServerPayload<PaginatedData<ThingChild>>> {
        let [responseData, statusCode, err] = await this._retrieve(pageNum, pageSize);

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [{
                ...responseData,
                data: responseData.data.map((data) => new ThingChild(data))
            }, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async exists(): Promise<ServerPayload<boolean>> {
        this._exists = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async count(): Promise<ServerPayload<number>> {
        this._count = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    private async _retrieve(pageNum?: number, pageSize?: number): Promise<ServerResponse> {
        let urlQuery = "query=" + JSON.stringify(this.serializeQuery());
        if (this._prefetch) { urlQuery += "&prefetch=" + JSON.stringify(this._prefetch) }
        if (this._orderBy) { urlQuery += "&order_by=" + JSON.stringify(this._orderBy) }
        if (this._distinct) { urlQuery += "&distinct=" + JSON.stringify(this._distinct) }
        if (this._exists) { urlQuery += "&exists=" + JSON.stringify(true) }
        if (this._count) { urlQuery += "&count=" + JSON.stringify(true) }
        if (this._valuesFields) { urlQuery += "&values=" + JSON.stringify(this._valuesFields) }
        if (pageNum) { urlQuery += "&page=" + pageNum }
        if (pageSize) { urlQuery += "&pageSize=" + pageSize }
        let [responseData, statusCode, err] = await serverClient.get(`thing-child/`, urlQuery);
        return [responseData, statusCode, err]
    }

}



// -------------------------
// ThingChild
//
// -------------------------


export interface ThingChildFields {
    readonly id: number
    name?: string
    number?: number
    parent_id: number
}


export class ThingChild implements ThingChildFields {

    readonly id: number
    name?: string
    number?: number
    parent_id: number
    @foreignKeyField(() => Thing) parent?: Thing
    private static _makeDetailLink?: (pk: number) => string;

    public static readonly FIELD_SCHEMAS: ModelFieldsSchema<FieldType> = {
        id: { fieldName: 'id', fieldType: 'AutoField', nullable: false, isReadOnly: true, description: null },
        name: { fieldName: 'name', fieldType: 'CharField', nullable: true, isReadOnly: false, description: null },
        number: { fieldName: 'number', fieldType: 'IntegerField', nullable: true, isReadOnly: false, description: null },
        parent_id: { fieldName: 'parent_id', fieldType: 'IntegerField', nullable: false, isReadOnly: false, relatedModel: () => Thing }
    }

    constructor(data: ThingChildFields) {
        Object.assign(this, data);
    }

    static objects = ThingChildQuerySet;

    public pk(): number {
        return this.id
    }

    public toJSON() {
        return this.pk()
    }

    public fieldData(): ThingChildFields {
        let fieldData = {}
        Object.keys(ThingChild.FIELD_SCHEMAS).map((fieldName) => fieldData[fieldName] = this[fieldName])
        return fieldData as ThingChildFields
    }

    public static setDetailLink(makeDetailLink: (pk: number) => string) {
        ThingChild._makeDetailLink = makeDetailLink;
    }

    public detailLink(): string | undefined {
        if (ThingChild._makeDetailLink) {
            return ThingChild._makeDetailLink(this.pk())
        }
        return undefined
    }

    public async refresh(...prefetchKeys: ThingChildPrefetchKey[]) {
        return ThingChildQuerySet.get(this.pk(), ...prefetchKeys)
    }

    public async update(data: Partial<ThingChildFields>, ...prefetchKeys: ThingChildPrefetchKey[]): Promise<ServerPayload<ThingChild>> {
        let urlQuery = "";
        if (prefetchKeys) { urlQuery += "&prefetch=" + JSON.stringify(prefetchKeys) }
        let [responseData, statusCode, err] = await serverClient.post(`thing-child/${this.pk()}/update/`, data, urlQuery);
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [new ThingChild(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err];
    }

    public async delete() {
        return await serverClient.delete(`thing-child/${this.pk()}/delete/`);
    }

    public children(lookups: ThingChildChildQuerySetLookups = {}) {
        return new ThingChildChildQuerySet({ ...lookups, ...{ parent: { id: this.pk() } } })
    }







}

// -------------------------
// ThingChildChildQuerySet
//
// -------------------------


export type ThingChildChildPrefetchKey = 'parent' | { parent: ThingChildPrefetchKey | ThingChildPrefetchKey[] }


export interface ThingChildChildQuerySetLookups {
    id?: number
    id__exact?: number
    id__iexact?: number
    id__gt?: number
    id__gte?: number
    id__lt?: number
    id__lte?: number
    id__in?: number[]
    id__contains?: number
    id__icontains?: number
    id__startswith?: number
    id__istartswith?: number
    id__endswith?: number
    id__iendswith?: number
    id__range?: [number, number]
    id__isnull?: boolean
    id__regex?: number
    id__iregex?: number
    name?: string
    name__exact?: string
    name__iexact?: string
    name__gt?: string
    name__gte?: string
    name__lt?: string
    name__lte?: string
    name__in?: string[]
    name__contains?: string
    name__icontains?: string
    name__startswith?: string
    name__istartswith?: string
    name__endswith?: string
    name__iendswith?: string
    name__range?: [string, string]
    name__isnull?: boolean
    name__regex?: string
    name__iregex?: string
    number?: number
    number__exact?: number
    number__iexact?: number
    number__gt?: number
    number__gte?: number
    number__lt?: number
    number__lte?: number
    number__in?: number[]
    number__contains?: number
    number__icontains?: number
    number__startswith?: number
    number__istartswith?: number
    number__endswith?: number
    number__iendswith?: number
    number__range?: [number, number]
    number__isnull?: boolean
    number__regex?: number
    number__iregex?: number
    parent_id?: number
    parent?: ThingChildQuerySetLookups
}

export class ThingChildChildQuerySet {

    protected lookups: ThingChildChildQuerySetLookups;
    protected excludedLookups: ThingChildChildQuerySetLookups;
    protected _or: ThingChildChildQuerySet[] = [];
    protected _prefetch: ThingChildChildPrefetchKey[];
    protected _orderBy?: string[];
    protected _distinct?: Array<keyof ThingChildChildFields>;
    protected _valuesFields?: Array<keyof ThingChildChildFields>;
    protected _exists?: boolean;
    protected _count?: boolean;

    constructor(lookups: ThingChildChildQuerySetLookups = {}, excludedLookups: ThingChildChildQuerySetLookups = {}) {
        this.lookups = lookups;
        this.excludedLookups = excludedLookups;
    }

    public clone(): ThingChildChildQuerySet {
        const clone = new ThingChildChildQuerySet()
        clone.lookups = this.lookups;
        clone._prefetch = this._prefetch;
        clone._orderBy = this._orderBy;
        clone._or = JSON.parse(JSON.stringify(this._or));
        clone.excludedLookups = this.excludedLookups;
        return clone;
    }

    public serializeQuery(): object {
        return {
            filters: flattenLookups(this.lookups),
            exclude: flattenLookups(this.excludedLookups),
            or_: this._or.map((queryset) => queryset.serializeQuery())
        }
    }

    public prefetch(...prefetchKeys: ThingChildChildPrefetchKey[]): this {
        const existingPrefetch: ThingChildChildPrefetchKey[] = this._prefetch ? (this._prefetch) : ([] as ThingChildChildPrefetchKey[]);
        this._prefetch = [...existingPrefetch, ...prefetchKeys];
        return this
    }

    public static all(): ThingChildChildQuerySet {
        return new ThingChildChildQuerySet()
    }

    public static filter(lookups: Partial<ThingChildChildQuerySetLookups>): ThingChildChildQuerySet {
        return new ThingChildChildQuerySet(lookups)
    }

    public filter(lookups: Partial<ThingChildChildQuerySetLookups>): ThingChildChildQuerySet {
        const clone = this.clone();
        clone.lookups = _.merge(clone.lookups, lookups);
        return clone
    }

    public static exclude(lookups: Partial<ThingChildChildQuerySetLookups>): ThingChildChildQuerySet {
        return new ThingChildChildQuerySet({}, lookups)
    }

    public exclude(lookups: Partial<ThingChildChildQuerySetLookups>): ThingChildChildQuerySet {
        return new ThingChildChildQuerySet(this.lookups, { ...this.excludedLookups, ...lookups })
    }

    public or(queryset: ThingChildChildQuerySet): this {
        this._or.push(queryset);
        return this
    }

    public static async get(primaryKey: number, ...prefetchKeys: ThingChildChildPrefetchKey[]): Promise<ServerPayload<ThingChildChild>> {
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.get(`thing-child-child/${primaryKey}/get/`, urlQuery);
        if (statusCode === 200) {
            return [new ThingChildChild(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async getOrCreate(lookup: Partial<ThingChildChildFields>, defaults: Partial<ThingChildChildFields> = {}, ...prefetchKeys: ThingChildChildPrefetchKey[]): Promise<ServerPayload<[ThingChildChild, boolean]>> {
        const data = { lookup, defaults };
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.post(`thing-child-child/get-or-create/`, data, urlQuery);

        if (statusCode === 201) {
            return [[new ThingChildChild(responseData), true], responseData, statusCode, err]
        }
        if (statusCode === 200) {
            return [[new ThingChildChild(responseData), false], responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async create(data: Partial<ThingChildChildFields>): Promise<ServerPayload<ThingChildChild>> {
        let [responseData, statusCode, err] = await serverClient.post(`thing-child-child/create/`, data);

        if (statusCode === 201) {
            return [new ThingChildChild(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async values(...fields: Array<keyof ThingChildChildFields>): Promise<ServerDataPayload<QuerysetValuesList<ThingChildChildFields>>> {
        this._valuesFields = fields;
        return await this._retrieve();
    }

    public async pageValues(pageNum: number = 1, pageSize: number = 25, ...fields: Array<keyof ThingChildChildFields>): Promise<ServerDataPayload<PaginatedData<QuerysetValuesList<ThingChildChildFields>>>> {
        this._valuesFields = fields;
        return await this._retrieve(pageNum, pageSize);
    }

    public order_by(...fields: ModelFieldOrdering<ThingChildChildFields>[]): this {
        this._orderBy = fields.map((fieldOrdering) => typeof fieldOrdering === 'string' ? (fieldOrdering) : (fieldOrdering.join('')));
        return this
    }

    public distinct(...fields: Array<keyof ThingChildChildFields>): this {
        this._distinct = fields;
        return this
    }

    public async retrieve(): Promise<ServerPayload<ThingChildChild[]>> {
        let [responseData, statusCode, err] = await this._retrieve();

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData.map((data) => new ThingChildChild(data)), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async retrievePage(pageNum: number = 1, pageSize: number = 25): Promise<ServerPayload<PaginatedData<ThingChildChild>>> {
        let [responseData, statusCode, err] = await this._retrieve(pageNum, pageSize);

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [{
                ...responseData,
                data: responseData.data.map((data) => new ThingChildChild(data))
            }, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async exists(): Promise<ServerPayload<boolean>> {
        this._exists = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async count(): Promise<ServerPayload<number>> {
        this._count = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    private async _retrieve(pageNum?: number, pageSize?: number): Promise<ServerResponse> {
        let urlQuery = "query=" + JSON.stringify(this.serializeQuery());
        if (this._prefetch) { urlQuery += "&prefetch=" + JSON.stringify(this._prefetch) }
        if (this._orderBy) { urlQuery += "&order_by=" + JSON.stringify(this._orderBy) }
        if (this._distinct) { urlQuery += "&distinct=" + JSON.stringify(this._distinct) }
        if (this._exists) { urlQuery += "&exists=" + JSON.stringify(true) }
        if (this._count) { urlQuery += "&count=" + JSON.stringify(true) }
        if (this._valuesFields) { urlQuery += "&values=" + JSON.stringify(this._valuesFields) }
        if (pageNum) { urlQuery += "&page=" + pageNum }
        if (pageSize) { urlQuery += "&pageSize=" + pageSize }
        let [responseData, statusCode, err] = await serverClient.get(`thing-child-child/`, urlQuery);
        return [responseData, statusCode, err]
    }

}



// -------------------------
// ThingChildChild
//
// -------------------------


export interface ThingChildChildFields {
    readonly id: number
    name?: string
    number?: number
    parent_id: number
}


export class ThingChildChild implements ThingChildChildFields {

    readonly id: number
    name?: string
    number?: number
    parent_id: number
    @foreignKeyField(() => ThingChild) parent?: ThingChild
    private static _makeDetailLink?: (pk: number) => string;

    public static readonly FIELD_SCHEMAS: ModelFieldsSchema<FieldType> = {
        id: { fieldName: 'id', fieldType: 'AutoField', nullable: false, isReadOnly: true, description: null },
        name: { fieldName: 'name', fieldType: 'CharField', nullable: true, isReadOnly: false, description: null },
        number: { fieldName: 'number', fieldType: 'IntegerField', nullable: true, isReadOnly: false, description: null },
        parent_id: { fieldName: 'parent_id', fieldType: 'IntegerField', nullable: false, isReadOnly: false, relatedModel: () => ThingChild }
    }

    constructor(data: ThingChildChildFields) {
        Object.assign(this, data);
    }

    static objects = ThingChildChildQuerySet;

    public pk(): number {
        return this.id
    }

    public toJSON() {
        return this.pk()
    }

    public fieldData(): ThingChildChildFields {
        let fieldData = {}
        Object.keys(ThingChildChild.FIELD_SCHEMAS).map((fieldName) => fieldData[fieldName] = this[fieldName])
        return fieldData as ThingChildChildFields
    }

    public static setDetailLink(makeDetailLink: (pk: number) => string) {
        ThingChildChild._makeDetailLink = makeDetailLink;
    }

    public detailLink(): string | undefined {
        if (ThingChildChild._makeDetailLink) {
            return ThingChildChild._makeDetailLink(this.pk())
        }
        return undefined
    }

    public async refresh(...prefetchKeys: ThingChildChildPrefetchKey[]) {
        return ThingChildChildQuerySet.get(this.pk(), ...prefetchKeys)
    }

    public async update(data: Partial<ThingChildChildFields>, ...prefetchKeys: ThingChildChildPrefetchKey[]): Promise<ServerPayload<ThingChildChild>> {
        let urlQuery = "";
        if (prefetchKeys) { urlQuery += "&prefetch=" + JSON.stringify(prefetchKeys) }
        let [responseData, statusCode, err] = await serverClient.post(`thing-child-child/${this.pk()}/update/`, data, urlQuery);
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [new ThingChildChild(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err];
    }

    public async delete() {
        return await serverClient.delete(`thing-child-child/${this.pk()}/delete/`);
    }








}

// -------------------------
// TimestampedModelQuerySet
//
// -------------------------


export type TimestampedModelPrefetchKey = never


export interface TimestampedModelQuerySetLookups {
    id?: number
    id__exact?: number
    id__iexact?: number
    id__gt?: number
    id__gte?: number
    id__lt?: number
    id__lte?: number
    id__in?: number[]
    id__contains?: number
    id__icontains?: number
    id__startswith?: number
    id__istartswith?: number
    id__endswith?: number
    id__iendswith?: number
    id__range?: [number, number]
    id__isnull?: boolean
    id__regex?: number
    id__iregex?: number
    name?: string
    name__exact?: string
    name__iexact?: string
    name__gt?: string
    name__gte?: string
    name__lt?: string
    name__lte?: string
    name__in?: string[]
    name__contains?: string
    name__icontains?: string
    name__startswith?: string
    name__istartswith?: string
    name__endswith?: string
    name__iendswith?: string
    name__range?: [string, string]
    name__isnull?: boolean
    name__regex?: string
    name__iregex?: string
    timestamp?: string
    timestamp__exact?: string
    timestamp__iexact?: string
    timestamp__gt?: string
    timestamp__gte?: string
    timestamp__lt?: string
    timestamp__lte?: string
    timestamp__in?: string[]
    timestamp__contains?: string
    timestamp__icontains?: string
    timestamp__startswith?: string
    timestamp__istartswith?: string
    timestamp__endswith?: string
    timestamp__iendswith?: string
    timestamp__range?: [string, string]
    timestamp__isnull?: boolean
    timestamp__regex?: string
    timestamp__iregex?: string
    timestamp__year?: string
    timestamp__month?: string
    timestamp__day?: string
    timestamp__week_day?: string
    timestamp__week?: string
    timestamp__quarter?: string
    timestamp__hour?: string
    timestamp__minute?: string
    timestamp__second?: string
    timestamp__date?: string
    timestamp__time?: string
}

export class TimestampedModelQuerySet {

    protected lookups: TimestampedModelQuerySetLookups;
    protected excludedLookups: TimestampedModelQuerySetLookups;
    protected _or: TimestampedModelQuerySet[] = [];
    protected _prefetch: TimestampedModelPrefetchKey[];
    protected _orderBy?: string[];
    protected _distinct?: Array<keyof TimestampedModelFields>;
    protected _valuesFields?: Array<keyof TimestampedModelFields>;
    protected _exists?: boolean;
    protected _count?: boolean;

    constructor(lookups: TimestampedModelQuerySetLookups = {}, excludedLookups: TimestampedModelQuerySetLookups = {}) {
        this.lookups = lookups;
        this.excludedLookups = excludedLookups;
    }

    public clone(): TimestampedModelQuerySet {
        const clone = new TimestampedModelQuerySet()
        clone.lookups = this.lookups;
        clone._prefetch = this._prefetch;
        clone._orderBy = this._orderBy;
        clone._or = JSON.parse(JSON.stringify(this._or));
        clone.excludedLookups = this.excludedLookups;
        return clone;
    }

    public serializeQuery(): object {
        return {
            filters: flattenLookups(this.lookups),
            exclude: flattenLookups(this.excludedLookups),
            or_: this._or.map((queryset) => queryset.serializeQuery())
        }
    }

    public prefetch(...prefetchKeys: TimestampedModelPrefetchKey[]): this {
        const existingPrefetch: TimestampedModelPrefetchKey[] = this._prefetch ? (this._prefetch) : ([] as TimestampedModelPrefetchKey[]);
        this._prefetch = [...existingPrefetch, ...prefetchKeys];
        return this
    }

    public static all(): TimestampedModelQuerySet {
        return new TimestampedModelQuerySet()
    }

    public static filter(lookups: Partial<TimestampedModelQuerySetLookups>): TimestampedModelQuerySet {
        return new TimestampedModelQuerySet(lookups)
    }

    public filter(lookups: Partial<TimestampedModelQuerySetLookups>): TimestampedModelQuerySet {
        const clone = this.clone();
        clone.lookups = _.merge(clone.lookups, lookups);
        return clone
    }

    public static exclude(lookups: Partial<TimestampedModelQuerySetLookups>): TimestampedModelQuerySet {
        return new TimestampedModelQuerySet({}, lookups)
    }

    public exclude(lookups: Partial<TimestampedModelQuerySetLookups>): TimestampedModelQuerySet {
        return new TimestampedModelQuerySet(this.lookups, { ...this.excludedLookups, ...lookups })
    }

    public or(queryset: TimestampedModelQuerySet): this {
        this._or.push(queryset);
        return this
    }

    public static async get(primaryKey: number, ...prefetchKeys: TimestampedModelPrefetchKey[]): Promise<ServerPayload<TimestampedModel>> {
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.get(`timestamped-model/${primaryKey}/get/`, urlQuery);
        if (statusCode === 200) {
            return [new TimestampedModel(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async getOrCreate(lookup: Partial<TimestampedModelFields>, defaults: Partial<TimestampedModelFields> = {}, ...prefetchKeys: TimestampedModelPrefetchKey[]): Promise<ServerPayload<[TimestampedModel, boolean]>> {
        const data = { lookup, defaults };
        let urlQuery = '';
        if (prefetchKeys) {
            urlQuery += "prefetch=" + JSON.stringify(prefetchKeys)
        }
        let [responseData, statusCode, err] = await serverClient.post(`timestamped-model/get-or-create/`, data, urlQuery);

        if (statusCode === 201) {
            return [[new TimestampedModel(responseData), true], responseData, statusCode, err]
        }
        if (statusCode === 200) {
            return [[new TimestampedModel(responseData), false], responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public static async create(data: Partial<TimestampedModelFields>): Promise<ServerPayload<TimestampedModel>> {
        let [responseData, statusCode, err] = await serverClient.post(`timestamped-model/create/`, data);

        if (statusCode === 201) {
            return [new TimestampedModel(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async values(...fields: Array<keyof TimestampedModelFields>): Promise<ServerDataPayload<QuerysetValuesList<TimestampedModelFields>>> {
        this._valuesFields = fields;
        return await this._retrieve();
    }

    public async pageValues(pageNum: number = 1, pageSize: number = 25, ...fields: Array<keyof TimestampedModelFields>): Promise<ServerDataPayload<PaginatedData<QuerysetValuesList<TimestampedModelFields>>>> {
        this._valuesFields = fields;
        return await this._retrieve(pageNum, pageSize);
    }

    public order_by(...fields: ModelFieldOrdering<TimestampedModelFields>[]): this {
        this._orderBy = fields.map((fieldOrdering) => typeof fieldOrdering === 'string' ? (fieldOrdering) : (fieldOrdering.join('')));
        return this
    }

    public distinct(...fields: Array<keyof TimestampedModelFields>): this {
        this._distinct = fields;
        return this
    }

    public async retrieve(): Promise<ServerPayload<TimestampedModel[]>> {
        let [responseData, statusCode, err] = await this._retrieve();

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData.map((data) => new TimestampedModel(data)), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async retrievePage(pageNum: number = 1, pageSize: number = 25): Promise<ServerPayload<PaginatedData<TimestampedModel>>> {
        let [responseData, statusCode, err] = await this._retrieve(pageNum, pageSize);

        if (statusCode in SuccessfulHttpStatusCodes) {
            return [{
                ...responseData,
                data: responseData.data.map((data) => new TimestampedModel(data))
            }, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async exists(): Promise<ServerPayload<boolean>> {
        this._exists = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    public async count(): Promise<ServerPayload<number>> {
        this._count = true;
        let [responseData, statusCode, err] = await this._retrieve();
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [responseData, responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err]
    }

    private async _retrieve(pageNum?: number, pageSize?: number): Promise<ServerResponse> {
        let urlQuery = "query=" + JSON.stringify(this.serializeQuery());
        if (this._prefetch) { urlQuery += "&prefetch=" + JSON.stringify(this._prefetch) }
        if (this._orderBy) { urlQuery += "&order_by=" + JSON.stringify(this._orderBy) }
        if (this._distinct) { urlQuery += "&distinct=" + JSON.stringify(this._distinct) }
        if (this._exists) { urlQuery += "&exists=" + JSON.stringify(true) }
        if (this._count) { urlQuery += "&count=" + JSON.stringify(true) }
        if (this._valuesFields) { urlQuery += "&values=" + JSON.stringify(this._valuesFields) }
        if (pageNum) { urlQuery += "&page=" + pageNum }
        if (pageSize) { urlQuery += "&pageSize=" + pageSize }
        let [responseData, statusCode, err] = await serverClient.get(`timestamped-model/`, urlQuery);
        return [responseData, statusCode, err]
    }

}



// -------------------------
// TimestampedModel
//
// -------------------------


export interface TimestampedModelFields {
    readonly id: number
    name?: string
    timestamp?: string
}


export class TimestampedModel implements TimestampedModelFields {

    readonly id: number
    name?: string
    timestamp?: string
    private static _makeDetailLink?: (pk: number) => string;

    public static readonly FIELD_SCHEMAS: ModelFieldsSchema<FieldType> = {
        id: { fieldName: 'id', fieldType: 'AutoField', nullable: false, isReadOnly: true, description: null },
        name: { fieldName: 'name', fieldType: 'CharField', nullable: true, isReadOnly: false, description: null },
        timestamp: { fieldName: 'timestamp', fieldType: 'DateTimeField', nullable: true, isReadOnly: false, description: null }
    }

    constructor(data: TimestampedModelFields) {
        Object.assign(this, data);
    }

    static objects = TimestampedModelQuerySet;

    public pk(): number {
        return this.id
    }

    public toJSON() {
        return this.pk()
    }

    public fieldData(): TimestampedModelFields {
        let fieldData = {}
        Object.keys(TimestampedModel.FIELD_SCHEMAS).map((fieldName) => fieldData[fieldName] = this[fieldName])
        return fieldData as TimestampedModelFields
    }

    public static setDetailLink(makeDetailLink: (pk: number) => string) {
        TimestampedModel._makeDetailLink = makeDetailLink;
    }

    public detailLink(): string | undefined {
        if (TimestampedModel._makeDetailLink) {
            return TimestampedModel._makeDetailLink(this.pk())
        }
        return undefined
    }

    public async refresh(...prefetchKeys: TimestampedModelPrefetchKey[]) {
        return TimestampedModelQuerySet.get(this.pk(), ...prefetchKeys)
    }

    public async update(data: Partial<TimestampedModelFields>, ...prefetchKeys: TimestampedModelPrefetchKey[]): Promise<ServerPayload<TimestampedModel>> {
        let urlQuery = "";
        if (prefetchKeys) { urlQuery += "&prefetch=" + JSON.stringify(prefetchKeys) }
        let [responseData, statusCode, err] = await serverClient.post(`timestamped-model/${this.pk()}/update/`, data, urlQuery);
        if (statusCode in SuccessfulHttpStatusCodes) {
            return [new TimestampedModel(responseData), responseData, statusCode, err]
        }
        return [undefined, responseData, statusCode, err];
    }

    public async delete() {
        return await serverClient.delete(`timestamped-model/${this.pk()}/delete/`);
    }








}


// -------------------------
// Types
//
// -------------------------

export type ServerModel = Thing | ThingOneToOneTarget | ThingChild | ThingChildChild | TimestampedModel

export type ServerModelClass = typeof Thing | typeof ThingOneToOneTarget | typeof ThingChild | typeof ThingChildChild | typeof TimestampedModel

export type ServerModelQueryset = ThingQuerySet | ThingOneToOneTargetQuerySet | ThingChildQuerySet | ThingChildChildQuerySet | TimestampedModelQuerySet
