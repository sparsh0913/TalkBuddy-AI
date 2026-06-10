import { AVAILABLE_LANGUAGES, AVAILABLE_PROFICIENCY_LEVELS, AVAILABLE_TOPICS, AVAILABLE_VOICES } from "@/lib/constants";
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
    disconnect: () => Promise<void>;
    selectedLanguage:string;
    selectedProficiencyLevel:string;
    selectedTopic:string;
    selectedAssistantVoice:string;

    setSelectedLanguage: (lang:string) =>void;
    setSelectedProficiencyLevel: (prof:string) =>void;
    setSelectedTopic: (topic:string) =>void;
    setSelectedAssistantVoice: (voice:string) =>void;

    toggleMute: ()=>void;
};

export const useAudioStore = create<AudioStore>()(
    devtools((set,get) => ({
        connectionState: ConnectionState.DISCONNECTED,
        liveManagerInstance: null,
        error:null,
        isMuted:false,
        transcript: [],
        selectedLanguage: AVAILABLE_LANGUAGES[0].code,
        selectedProficiencyLevel:AVAILABLE_PROFICIENCY_LEVELS[0].label,
       selectedTopic: AVAILABLE_TOPICS[0],
       selectedAssistantVoice:AVAILABLE_VOICES[0].name,

        toggleMute: ()=>{
            const state = get();
            set({isMuted: !state.isMuted});
            state.liveManagerInstance?.setMute(!state.isMuted);
        },
        setSelectedLanguage: (lang:string) =>{
            set({selectedLanguage:lang})
        },
    setSelectedProficiencyLevel: (prof:string) =>{
        set({selectedProficiencyLevel:prof})
    },
    setSelectedTopic: (topic:string) =>{
        set({selectedTopic:topic})
    },
    setSelectedAssistantVoice: (voice:string) => {
        set({selectedAssistantVoice:voice})
    },

       connect: async ()=>{
       const state = get();
        //get ephermeral tokens
        const response = await fetch('/api/token');
        if(!response.ok){
       set({error:"failed to generate token"});
       return;
        }

        const {token} = await response.json();
      
    
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
                onAudioLevel: ()=> {}
            },
            token.name);
            set({liveManagerInstance:manager})
        }
    
        //connect session
        manager.startSession({
            selected_assistant_voice:state.selectedAssistantVoice,
            selected_launguage_code: AVAILABLE_LANGUAGES.find((l)=> l.code === state.selectedLanguage)?.code || 'en-US',
            selected_launguage_name: AVAILABLE_LANGUAGES.find((l)=> l.code === state.selectedLanguage)?.name || 'English',
            selected_launguage_region: AVAILABLE_LANGUAGES.find((l)=> l.code === state.selectedLanguage)?.region || 'US',
            description:state.selectedTopic,
            selected_topic:state.selectedTopic,
            selected_proefficent_level:state.selectedProficiencyLevel
        });
       },

       disconnect:async ()=>{
        
        const state = get();
        state.liveManagerInstance?.disconnect();

        set({liveManagerInstance : undefined})  
        set({
            connectionState: ConnectionState.DISCONNECTED
        })
    }
    }))
)