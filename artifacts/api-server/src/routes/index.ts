import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import channelsRouter from "./channels";
import transcriberRouter from "./transcriber";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(dashboardRouter);
router.use(channelsRouter);
router.use(transcriberRouter);

export default router;
