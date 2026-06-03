import { LiveManager } from "@/services/liveManager";
import { ConnectionState } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type AudioStore = {
    connectionState:ConnectionState;
    error: string | null;
    liveManagerInstance: LiveManager | null;
    connect: () => Promise<void>;
};

export const useAudioStore = create<AudioStore>()(
    devtools((set,get) => ({
        connectionState: ConnectionState.DISCONNECTED,
        liveManagerInstance: null,
        error:null,
       connect: async ()=>{
        const state = get();
        
        if(state.connectionState === ConnectionState.CONNECTING || state.connectionState === ConnectionState.CONNECTED ){
            return;
        }

        set({error:null});

        //check permission
        try{
         await navigator.mediaDevices.getUserMedia({
            audio: true
        })
        } catch{
            set({error: 'microphone permission denied'})
        }
       
        
        //creating instance(singleton)
        let manager = state.liveManagerInstance;
        if(!manager){
            //@ts-ignore
            manager = new LiveManager({
                onStateChange: (state) => 
                    set({connectionState:state}),
                onError:(err)=>set({error:err})
            });
            set({liveManagerInstance:manager})
        }
    
        //connect session
        manager.startSession();
       }
    }))
)