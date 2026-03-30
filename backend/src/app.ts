import express from 'express';
import cors from 'cors';
import { configureRoutes } from '@/routing/routes';
import { errorHandler } from '@/middleware/errorHandler';

export const app = express();

app.use(cors());
app.use(express.json());

configureRoutes(app);
app.use(errorHandler);
