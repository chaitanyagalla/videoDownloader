import { Router } from "express";
import { createAuthController } from "../controllers/authController";
import { optionalAuth } from "../middleware/authMiddleware";

export function createAuthRouter(): Router {
  const router = Router();
  const controller = createAuthController();

  router.get("/me", optionalAuth, controller.me);
  router.get("/google", controller.startGoogleAuth);
  router.get("/google/callback", controller.handleGoogleCallback);
  router.post("/logout", controller.logout);

  return router;
}
