import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import channelsRouter from "./channels";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(channelsRouter);

export default router;
