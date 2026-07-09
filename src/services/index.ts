import type { AuthService, ProfileService } from './interfaces';
import { apiAuthService } from './api/authService';
import { apiProfileService } from './api/profileService';
import { apiCatalogService } from './api/catalogService';
import { apiDeckService } from './api/deckService';
import { apiAdminService } from './api/adminService';

interface Services {
  auth: AuthService;
  profile: ProfileService;
  catalog: typeof apiCatalogService;
  decks: typeof apiDeckService;
  admin: typeof apiAdminService;
}

// Single concrete implementation for now ('api' = our NestJS backend).
// A different backend = a new folder implementing the same interfaces.
const services: Services = {
  auth: apiAuthService,
  profile: apiProfileService,
  catalog: apiCatalogService,
  decks: apiDeckService,
  admin: apiAdminService,
};

export function getServices(): Services {
  return services;
}
