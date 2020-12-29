import {QueryOptions} from "@ckb-lumos/base";


export interface IndexerSubscribe {
    subscribe(queryOptions: QueryOptions): NodeJS.EventEmitter
}
