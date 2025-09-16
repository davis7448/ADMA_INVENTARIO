import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI({api: 'vertex'})],
  // model: googleAI.model('gemini-1.5-pro'), // Removing global model config to set it locally in each flow
});
