import {ModelClass} from "./types";
import {ServerClient} from './serverClient'


// -------------------------
// Primary Key
//
// -------------------------

export type PrimaryKey = number;


// -------------------------
// Field Types
//
// -------------------------

export enum FieldType {
    CharField = "CharField",
    IntegerField = "IntegerField",
    ForeignKey = "ForeignKey",
    OneToOneField = "OneToOneField",
    JSONField = "JSONField",
    ArrayField = "ArrayField",
    FloatField = "FloatField",
    TextField = "TextField",
    BooleanField = "BooleanField",
    DateField = "DateField",
    DateTimeField = "DateTimeField",
    AutoField = "AutoField",
    EncryptedField = "EncryptedField",
    EmailField = "EmailField",
    ManyToManyField = "ManyToManyField",
    PartitionField = "PartitionField",
    NullBooleanField = "NullBooleanField"
}


// -------------------------
// Model Fields Schema
//
// -------------------------


// -------------------------
// Foreign Key Field
//
// -------------------------

export const foreignKeyField = (RelatedModel: () => any) =>

    function (target: any, propertyKey: string) {



        // Key for retrieving the ID value of this foreign key relation.
        const idPropertyKey = propertyKey + '_id';

        const backingField = "_" + propertyKey;

        Object.defineProperty(target, backingField, {
            writable: true,
            enumerable: true,
            configurable: true
        });

        let value = target[propertyKey];
        let cachedValue = null;


        const syncGet = () => {
            return cachedValue
        }

        Object.defineProperty(target, propertyKey, {

            get: function () {
                if (this[backingField]) {
                    return this[backingField]
                }
                const asyncGet = async () => {
                    const idValue = this[idPropertyKey];
                    if (idValue) {
                        const _RelatedModel = RelatedModel();
                        [value] = await _RelatedModel.objects.get(this[idPropertyKey]);
                        this[backingField] = value;
                        return value
                    }
                };
                return asyncGet()
            },
            set: function (val) {
                const _RelatedModel = RelatedModel();
                if (val instanceof _RelatedModel) {
                    this[backingField] = val;
                } else {
                    if (typeof val === 'object') {
                        this[backingField] = new _RelatedModel(val);
                    }
                }

            }
        });

    };


// -------------------------
// Property Field
//
// -------------------------

export const propertyField = (url: (pk) => string, serverClient: ServerClient) =>

    function (target: any, propertyKey: string) {

        const backingField = "_" + propertyKey;

        Object.defineProperty(target, backingField, {
            writable: true,
            enumerable: true,
            configurable: true
        });


        Object.defineProperty(target, propertyKey, {

            get: function () {
                if (this[backingField] !== undefined) {
                    return this[backingField]
                }
                const asyncGet = async () => {
                    let value;
                     [value] = await serverClient.get(url(this.pk()));
                        this[backingField] = value;
                        return value
                };
                return asyncGet()
            },
            set: function (val) {
                this[backingField] = val;
            }
        });

    };


// -------------------------
// Date Time Field
//
// -------------------------


export const dateTimeField = () =>

    function (target: any, propertyKey: string) {

        let val;

        Object.defineProperty(target, propertyKey, {

            get: function () {
                return val;
            },
            set: function (value: string | Date) {
                if (value instanceof Date) {
                    val = value.toISOString()
                } else {
                    val = value
                }

            }
        });

    };