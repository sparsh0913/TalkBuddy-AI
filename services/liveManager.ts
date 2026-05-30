import { MODEL } from '@/lib/constants';
import { GoogleGenAI, Modality, Session } from '@google/genai';

export class LiveManager {
private ai: GoogleGenAI;
private activeSession: Session | null = null;

constructor(){
this.ai = new GoogleGenAI({
  apiKey:process.env.NEXT_PUBLIC_GEMINI_API_KEY,
});
}
   async startSession(){
    const config = { 
      responseModalities: [Modality.AUDIO],
      systemInstruction : "You are a helpful and friendly AI Assisant" };
this.activeSession = await this.ai.live.connect({
    model: MODEL,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message) {
        console.debug(message);
      },
      onerror: function (e) {
        console.debug('Error:', e.message);
      },
      onclose: function (e) {
        console.debug('Close:', e.reason);
      },
    },
    config: config,
  });
  console.log("session", this.activeSession);
    }
}