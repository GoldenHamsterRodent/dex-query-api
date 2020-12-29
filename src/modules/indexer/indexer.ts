import {Cell, QueryOptions, Script, Transaction, TransactionWithStatus} from "@ckb-lumos/base";
import {CellCollector, Indexer, TransactionCollector,} from "@ckb-lumos/indexer";
import {inject, injectable, LazyServiceIdentifer} from "inversify";
import {contracts, indexer_config} from "../../config";
import {CkbUtils, DexOrderData} from '../../component';
import {IndexerService} from './indexer_service';
import CkbService from '../ckb/ckb_service';
import {modules} from '../../ioc';
import {IndexerSubscribe} from './indexer_subscribe';


@injectable()
export default class IndexerWrapper implements IndexerService, IndexerSubscribe {
  private indexer: Indexer;

  constructor(
    @inject(new LazyServiceIdentifer(() => modules[CkbService.name]))
    private ckbService: CkbService,
  ) {
    this.indexer = new Indexer(indexer_config.nodeUrl, indexer_config.dataPath);
    this.indexer.startForever();

    setInterval(async () => {
      const { block_number } = await this.indexer.tip();
      console.log("indexer tip block", parseInt(block_number, 16));
    }, 5000);
  }
  subscribe(queryOptions: QueryOptions): NodeJS.EventEmitter {
    try {
      //向indexer订阅,当收到changed反馈的时候,发还给DexEvent
      return this.indexer.subscribe(queryOptions)
    } catch (error) {
      console.error(error)
    }
  }

  async tip(): Promise<number> {
    const { block_number } = await this.indexer.tip();
    return parseInt(block_number, 16);
  }

  async collectCells(queryOptions: QueryOptions): Promise<Array<Cell>> {
    const cellCollector = new CellCollector(this.indexer, queryOptions);

    const cells = [];
    for await (const cell of cellCollector.collect()) cells.push(cell);


    return cells;
  }

  async collectTransactions(queryOptions: QueryOptions): Promise<Array<TransactionWithStatus>> {
    const transactionCollector = new TransactionCollector(
      this.indexer,
      queryOptions
    );

    const txs = [];
    for await (const tx of transactionCollector.collect()) txs.push(tx);

    return txs;
  }

  async getLastMatchOrders(
    type: Script
  ): Promise<Record<'ask_orders' | 'bid_orders', Array<DexOrderData>> | null> {
    const transactionCollector = new TransactionCollector(
      this.indexer,
      {
        type,
        lock: {
          script: {
            code_hash: contracts.orderLock.codeHash,
            hash_type: contracts.orderLock.hashType,
            args: "0x",
          },
          argsLen: 'any'
        },
        order: "desc",
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const { tx_status, transaction } of transactionCollector.collect() as any) {

      if (tx_status.status === 'committed') {
        const bid_orders: Array<DexOrderData> = [];
        const ask_orders: Array<DexOrderData> = [];
        const { inputs, outputs, outputs_data } = transaction as Transaction;

        if(!outputs.find(x => CkbUtils.isOrder(type, x))) {
          continue;
        }

        const requests = [];
        for (const input of inputs) {
          requests.push(["getTransaction", input.previous_output.tx_hash]);
        }
        const inputTxs = await this.ckbService.getTransactions(requests);

        if(!inputTxs.find(x => x.ckbTransactionWithStatus.transaction.outputsData.find(y => y.length === CkbUtils.getRequiredDataLength()))) {
          continue;
        }

        for (const data of outputs_data) {
          if(data.length !== CkbUtils.getRequiredDataLength()) {
            continue;
          }
          const orderCell = CkbUtils.parseOrderData(data);
          (orderCell.isBid ? bid_orders : ask_orders).push(orderCell);

        }

        if (ask_orders.length && bid_orders.length) {
          return { ask_orders, bid_orders };
        }
      }
    }
    return null;
  }

}
