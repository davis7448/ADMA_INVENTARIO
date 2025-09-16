import {genkit} from 'genkit';
import {googleAI as googleAIPlugin} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAIPlugin({api: 'vertex'})],
});
