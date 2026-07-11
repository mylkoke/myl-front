import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Logger,
  OnModuleInit,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IsArray, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AbilityCategory, SpecialAbility, SpecialAbilityDocument } from './special-ability.schema';
import { SEED_ABILITIES } from '../cards/seed-cards';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';
import { env } from '../config/env';

class CreateAbilityDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'El code solo admite minúsculas, números y guiones' })
  @MaxLength(30)
  code: string;

  @IsString() @MaxLength(40) nombre: string;
  @IsOptional() @IsString() @MaxLength(300) descripcion?: string;
  @IsOptional() @IsIn(['especial', 'carta']) categoria?: AbilityCategory;
  @IsOptional()
  @IsArray()
  @IsIn(['aliado', 'totem', 'arma', 'talisman', 'oro'], { each: true })
  tipos?: string[];
}

@Injectable()
export class AbilitiesService implements OnModuleInit {
  private readonly logger = new Logger(AbilitiesService.name);

  constructor(
    @InjectModel(SpecialAbility.name)
    private readonly model: Model<SpecialAbilityDocument>,
  ) {}

  async onModuleInit() {
    if (!env.mongodbUri) return;
    for (const ability of SEED_ABILITIES) {
      // categoria y tipos van en $set para que instalaciones existentes
      // reciban reclasificaciones sin recrear el documento.
      const { categoria, tipos, ...rest } = ability as (typeof SEED_ABILITIES)[number] & {
        tipos?: string[];
      };
      await this.model.updateOne(
        { code: ability.code },
        { $setOnInsert: rest, $set: { categoria, tipos: tipos ?? [] } },
        { upsert: true },
      );
    }
    this.logger.log('Special abilities seeded');
  }

  list(): Promise<SpecialAbility[]> {
    return this.model.find().sort({ created_at: 1 }).lean();
  }

  async create(dto: CreateAbilityDto): Promise<SpecialAbility> {
    const existing = await this.model.findOne({ code: dto.code }).lean();
    if (existing) throw new ConflictException('Ya existe una habilidad con ese code');
    // New abilities start without a game interaction (implemented: false).
    const doc = await this.model.create({ ...dto, implemented: false });
    return doc.toObject();
  }
}

@Controller('special-abilities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbilitiesController {
  constructor(private readonly abilities: AbilitiesService) {}

  @Get()
  async list() {
    return { success: true, data: await this.abilities.list() };
  }

  @Post()
  @Roles('admin', 'supervisor')
  async create(@Body() dto: CreateAbilityDto) {
    return { success: true, data: await this.abilities.create(dto) };
  }
}
