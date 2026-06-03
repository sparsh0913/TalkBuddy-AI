import { LiveManager } from "@/services/liveManager";
import { ConnectionState, TranscriptItem } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type AudioStore = {
    connectionState:ConnectionState;
    error: string | null;
    isMuted:boolean;
    liveManagerInstance: LiveManager | null;
    transcript:TranscriptItem[];
    connect: () => Promise<void>;
    toggleMute: ()=>void;
};

export const useAudioStore = create<AudioStore>()(
    devtools((set,get) => ({
        connectionState: ConnectionState.DISCONNECTED,
        liveManagerInstance: null,
        error:null,
        isMuted:false,
        transcript: [],
        toggleMute: ()=>{
            const state = get();
            set({isMuted: !state.isMuted});
            state.liveManagerInstance?.setMute(!state.isMuted);
        },
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
        //handling transcript and states
        if(!manager){
            //@ts-ignore
            manager = new LiveManager({
                onStateChange: (state) => 
                    set({connectionState:state}),
                onError:(err)=>set({error:err}),
                onTranscript(sender, text, isPartial) {
                   return set((state) =>{
                     const newTranscript = [...state.transcript];
                    const existingIndex = newTranscript.findLastIndex((item)=>{
                        return (
                            item.sender === sender && item.isPartial
                        )
                    })

                    //partial message exists
                    if(existingIndex !== -1){
                    newTranscript[existingIndex] = {
                   ...newTranscript[existingIndex],
                   text,
                   isPartial
                    };
                    return  {transcript : newTranscript};
                } else{
                    if(text){
                          newTranscript.push({
                        id: crypto.randomUUID(),
                        sender,
                        text,
                        isPartial
                    })

                    }
                  
                     return  {transcript : newTranscript};
                }
                   })
                },
            });
            set({liveManagerInstance:manager})
        }
    
        //connect session
        manager.startSession();
       }
    }))
)