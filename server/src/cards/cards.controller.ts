import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { CardsService } from './cards.service';
import { CardType } from './card.schema';
import { JwtAuthGuard, Roles, RolesGuard, CurrentUser } from '../auth/guards';
import { AuthenticatedUser } from '../auth/jwt.strategy';

class CardDto {
  @IsString() @MaxLength(60) nombre: string;
  @IsIn(['aliado', 'totem', 'arma', 'talisman', 'oro']) tipo: CardType;
  @IsOptional() @IsInt() fuerza?: number;
  @IsOptional() @IsInt() coste?: number;
  @IsOptional() @IsString() @MaxLength(500) historia?: string;
  @IsOptional() @IsString() @MaxLength(500) habilidad?: string;
  @IsOptional() @IsNumber() bonus_fuerza?: number;
  @IsOptional() @IsString() @MaxLength(40) raza?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) special_abilities?: string[];
  @IsOptional() @IsString() tipo_sello?: string;
  @IsOptional() @IsString() rareza?: string;
  @IsOptional() @IsString() expansion?: string;
  @IsOptional() @IsString() ilustrador?: string;
  @IsOptional() @IsInt() cantidad_edicion?: number;
  @IsOptional() @IsInt() numero_carta?: number;
  @IsUrl({ require_tld: false }) image_url: string;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsBoolean() available_to_common?: boolean;
  @IsOptional() @IsBoolean() logica_pendiente?: boolean;
}

class PartialCardDto extends CardDto {
  @IsOptional() @IsString() @MaxLength(60) declare nombre: string;
  @IsOptional() @IsIn(['aliado', 'totem', 'arma', 'talisman', 'oro']) declare tipo: CardType;
  @IsOptional() @IsUrl({ require_tld: false }) declare image_url: string;
}

@Controller('cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.cards.listForRole(user.role) };
  }

  @Post()
  @Roles('admin', 'supervisor')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CardDto) {
    return { success: true, data: await this.cards.create(user.id, dto) };
  }

  @Patch(':id')
  @Roles('admin', 'supervisor')
  async update(@Param('id') id: string, @Body() dto: PartialCardDto) {
    return { success: true, data: await this.cards.update(id, dto) };
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  async remove(@Param('id') id: string) {
    await this.cards.remove(id);
    return { success: true, data: null };
  }

  @Post('upload-signature')
  @Roles('admin', 'supervisor')
  uploadSignature() {
    return { success: true, data: this.cards.uploadSignature('myl/cards') };
  }
}

/** Signature endpoint for board background images: any authenticated user. */
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly cards: CardsService) {}

  @Post('board-signature')
  boardSignature(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      data: this.cards.uploadSignature(`myl/boards/${user.id}`),
    };
  }
}
