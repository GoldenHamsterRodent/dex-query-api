import {Server, Socket} from 'socket.io';
import http from "http";
import {container, modules} from '../ioc';
import IndexerWrapper from '../modules/indexer/indexer';
import {QueryOptions} from "@ckb-lumos/base";
import {IndexerService} from "../modules/indexer/indexer_service";
import {IndexerSubscribe} from "../modules/indexer/indexer_subscribe";

export class EventContext {
    public static socket_io_server: Server;
    public static indexer_wrapper: IndexerService & IndexerSubscribe;

    static init(httpServer: http.Server): void {
      EventContext.socket_io_server = new Server(httpServer);
      EventContext.indexer_wrapper = container.get(modules[IndexerWrapper.name]);
      EventContext.socket_io_server.on('connection',EventContext.connection)
    }
    static connection(socket: Socket): void {

      let last_block = 0;
      let indexer_emitter = null;
      socket.on('dex-event', async (queryOptions_jsonstr) => {
        try {
          const queryOptions : QueryOptions = JSON.parse(queryOptions_jsonstr);
          indexer_emitter = EventContext.indexer_wrapper.subscribe(queryOptions)


          indexer_emitter.on('error', (error) => {
            indexer_emitter.removeAllListeners()
            socket.disconnect(true)
          })

          indexer_emitter.on('changed', async () => {
            console.log('changed')
            const block = await EventContext.indexer_wrapper.tip();
            if(last_block === block) {
              return
            }else{
              last_block = block
            }
            socket.emit("order-change", last_block)
          })

        } catch (error) {
          console.error(error);
        }
      });

      socket.on('disconnect',(reason) => {
        //unsubscribe to indexer
        if(indexer_emitter === null){
          return
        }
        indexer_emitter.removeAllListeners('changed')
        indexer_emitter.removeAllListeners('error')
        console.log(`client disconnect for: >${reason}<`)
      })
    }

}
