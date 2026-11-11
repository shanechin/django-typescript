const assert = require('assert');
const path = require('path');

const buildDir = process.argv[2];
if (!buildDir) {
    throw new Error('usage: node tests/check_generated_client.js BUILD_DIR');
}

const {buildUrlQuery, ListQuery} = require(path.join(buildDir, 'core', 'serverClient.js'));

const query = buildUrlQuery({
    page: 2,
    pageSize: 10,
    query: JSON.stringify({filters: {name: 'a'}}),
    values: JSON.stringify(['name']),
    ignored: undefined,
    also: null,
});
assert.ok(query.includes('page=2'), query);
assert.ok(query.includes('pageSize=10'), query);
assert.ok(query.includes('values='), query);
assert.ok(query.includes('query='), query);
assert.ok(!query.includes('ignored'), query);
assert.ok(!query.split('&').some((part) => part.startsWith('also=')), query);

const list = new ListQuery([{tag: 'name'}], ['title'], {filters: {}}, 3, 5);
const url = list.urlString();
assert.strictEqual(typeof url, 'string');
assert.ok(url.includes('page=3'), url);
assert.ok(url.includes('pageSize=5'), url);
assert.ok(url.includes('prefetch='), url);
assert.ok(url.includes('values='), url);

const fieldsEncoded = encodeURIComponent(JSON.stringify(['title']));
const prefetchEncoded = encodeURIComponent(JSON.stringify([{tag: 'name'}]));
assert.ok(url.includes(prefetchEncoded), url);
assert.ok(url.includes(fieldsEncoded), url);
assert.ok(!url.includes('prefetch=' + fieldsEncoded), url);

console.log('generated client runtime checks passed');
