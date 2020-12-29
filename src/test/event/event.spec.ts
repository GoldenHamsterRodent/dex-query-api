import * as events from "events";

import SocketMock from 'socket.io-mock';

import {Cell, QueryOptions, Script, TransactionWithStatus} from "@ckb-lumos/base";
import {EventContext} from "../../component/chian_event";
import {DexOrderData} from '../../component';
import {IndexerService} from "../../modules/indexer/indexer_service";
import {IndexerSubscribe} from "../../modules/indexer/indexer_subscribe";

import chai from 'chai';
const expect = chai.expect;

class MockIndexer implements IndexerService, IndexerSubscribe{

  public _tip = 0;
  public ee : NodeJS.EventEmitter
  constructor() {
    this.ee = new events.EventEmitter();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribe(queryOptions: QueryOptions): NodeJS.EventEmitter {
    return this.ee;
  }

  set set_tip(input) {
    this._tip = input
  }

  async tip(): Promise<number> {
    return Promise.resolve(this._tip);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async collectCells(queryOptions: QueryOptions): Promise<Array<Cell>> {
    return Promise.resolve(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async collectTransactions(queryOptions: QueryOptions): Promise<Array<TransactionWithStatus>> {
    return Promise.resolve(undefined);
  }


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getLastMatchOrders(type: Script): Promise<Record<"ask_orders" | "bid_orders", Array<DexOrderData> | null>> {
    return Promise.resolve(undefined);
  }


}

class MockEventContext extends EventContext{


  static q = {
    lock: {
      code_hash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
      hash_type: "data",
      args: "0x62e907b15cbf27d5425399ebf6f0fb50ebb88f18",
    },
  };


  static socket;
  static mock_indexer;
  static init() {
    EventContext.socket_io_server = undefined;

    MockEventContext.mock_indexer = new MockIndexer()
    EventContext.indexer_wrapper = MockEventContext.mock_indexer

    MockEventContext.socket = new SocketMock()
    EventContext.connection(MockEventContext.socket)

    MockEventContext.socket.socketClient.emit('dex-event',JSON.stringify(MockEventContext.q));

    MockEventContext.socket.socketClient.on('order-change', function (last_block) {
      console.log(`order-change: >${last_block}<`);
    });


    return MockEventContext.socket.socketClient;
  }
}


describe('event test', () => {

  beforeEach(() => {
    MockEventContext.init()
  });

  it('normal', () => {


    MockEventContext.mock_indexer.set_tip = 1;
    MockEventContext.mock_indexer.ee.emit('changed')

  });

  it('indexer error', () => {

    MockEventContext.socket.socketClient.on('disconnect', function (msg) {
      console.log(`disconnect: >${msg}<`);
    });

    MockEventContext.mock_indexer.set_tip = 2;
    MockEventContext.mock_indexer.ee.emit('error')

  });

  it('client disconnect', () => {


    MockEventContext.mock_indexer.set_tip = 2;
    MockEventContext.socket.socketClient.disconnect()

  });
});

