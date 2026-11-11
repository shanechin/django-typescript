import fetch from 'node-fetch';

import {HeaderMiddleware, RequestMethod, ServerResponse} from "./types";


// -------------------------
// Server Client
//
// -------------------------


const JSON_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
};


export class ServerClient {

    public baseUrl: string;
    public headerMiddleware: HeaderMiddleware;

    constructor() {
        this.baseUrl = '';
        this.headerMiddleware = (header) => header
    }

    public setup(baseUrl: string, headerMiddleware?: HeaderMiddleware){
        this.baseUrl = baseUrl;
        if (headerMiddleware){
            this.headerMiddleware = headerMiddleware;
        }
    }

    public request(url: string, requestOptions: object): Promise<ServerResponse>{
        return fetch(url, requestOptions as any)
            .then(async (res) => {
                const text = await res.text();
                let data: any = undefined;
                if (text) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        data = text;
                    }
                }
                return [data, res.status, undefined] as ServerResponse;
            })
            .catch((err) => {
                return [undefined, undefined, err] as ServerResponse;
            });
    }

    private _requestOptions(requestMethod: RequestMethod, headers?: object, body?: any | undefined): object{
        if (!headers){
            headers = {}
        }
        const requestOptions: {method: RequestMethod, headers?: object, body?: any} = {
            method: requestMethod,
        };
        if (body !== undefined){requestOptions.body = body}
        requestOptions.headers = this.headerMiddleware(headers);
        return requestOptions
    }

    /**
     * Send a GET request to given url.
     *
     */
    public async get(url: string, urlQuery?: string): Promise<ServerResponse>{
        return this.request(this._buildUrl(url, urlQuery), this._requestOptions(RequestMethod.GET));
    }

    /**
     * Send a POST request to given url.
     *
     */
    public async post(url: string, postData?: object, urlQuery?: string): Promise<ServerResponse> {
        return this.request(
            this._buildUrl(url, urlQuery),
            this._requestOptions(RequestMethod.POST, JSON_HEADERS, JSON.stringify(postData === undefined ? {} : postData))
        );
    }

    /**
     * Send a PATCH request to given url.
     *
     */
    public async patch(url: string, patchData?: object): Promise<ServerResponse> {
        return this.request(
            this._buildUrl(url),
            this._requestOptions(RequestMethod.PATCH, JSON_HEADERS, JSON.stringify(patchData === undefined ? {} : patchData))
        );
    }

    /**
     * Send a DELETE request to given url.
     *
     */
    public async delete(url: string, postData?: object): Promise<ServerResponse> {
        const body = postData === undefined ? undefined : JSON.stringify(postData);
        const headers = postData === undefined ? {} : JSON_HEADERS;
        return this.request(this._buildUrl(url), this._requestOptions(RequestMethod.DELETE, headers, body));
    }

    private _buildUrl(url: string, urlQuery?: string): string {
        let fullUrl = this.baseUrl + url;
        if (urlQuery){
            fullUrl = fullUrl + '?' + urlQuery
        }
        return fullUrl
    }
}


// -------------------------
// URL Query
//
// -------------------------

/**
 * Serialize a map of query parameters.
 *
 * Objects are JSON-encoded. `null` and `undefined` values are omitted so
 * callers can pass optional pagination and filter arguments through.
 */
export const buildUrlQuery = (paramValues?: Record<string, any> | null): string => {
    if (!paramValues) {
        return '';
    }
    const parts: string[] = [];
    Object.keys(paramValues).forEach((key) => {
        const value = paramValues[key];
        if (value === undefined || value === null) {
            return;
        }
        const encoded = (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
            ? String(value)
            : JSON.stringify(value);
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(encoded));
    });
    return parts.join('&');
};


// -------------------------
// List Query
//
// -------------------------

export class ListQuery {

    private prefetchKeys?: Array<string | object>;
    private fields?: string[];
    private query?: object;
    private pageNum?: number;
    private pageSize?: number;

    constructor(prefetchKeys?: Array<string | object>, fields?: string[], query?: object, pageNum?: number,
                pageSize?: number) {
        this.prefetchKeys = prefetchKeys;
        this.fields = fields;
        this.query = query;
        this.pageNum = pageNum;
        this.pageSize = pageSize;
    }

    /**
     * Query string understood by the list view: `query`, `values`, `prefetch`,
     * `page`, and `pageSize`.
     */
    urlString(): string {
        return buildUrlQuery({
            query: this.query === undefined ? undefined : JSON.stringify(this.query),
            values: this.fields === undefined ? undefined : JSON.stringify(this.fields),
            prefetch: this.prefetchKeys === undefined ? undefined : JSON.stringify(this.prefetchKeys),
            page: this.pageNum,
            pageSize: this.pageSize,
        });
    }

}
