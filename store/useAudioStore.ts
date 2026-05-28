import { create } from "zustand";
import { devtools } from "zustand/middleware";

type AudioStore = {
    connect: () => void;
};

export const useAudioStore = create<AudioStore>()(
    devtools((set,get) => ({
       connect: ()=>{
        //connect session
       }
    }))
)