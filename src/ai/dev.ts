import { config } from 'dotenv';
config();

import '@/ai/flows/restock-alert-generation.ts';
import '@/ai/flows/stock-monitoring.ts';
import '@/ai/flows/summarize-day.ts';
