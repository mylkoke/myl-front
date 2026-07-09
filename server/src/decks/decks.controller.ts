import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { DecksService } from './decks.service';
import { JwtAuthGuard, CurrentUser } from '../auth/guards';
import { AuthenticatedUser } from '../auth/jwt.strategy';

class DeckEntryDto {
  @IsString() card_id: string;
  @IsInt() @Min(1) qty: number;
}

class SetEntriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeckEntryDto)
  entries: DeckEntryDto[];
}

@Controller('decks')
@UseGuards(JwtAuthGuard)
export class DecksController {
  constructor(private readonly decks: DecksService) {}

  @Get()
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.decks.listMine(user.id) };
  }

  @Get('active/cards')
  async activeCards(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.decks.getActiveDeckCards(user.id) };
  }

  @Get(':id')
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { success: true, data: await this.decks.getMine(user.id, id) };
  }

  @Put(':id/entries')
  async setEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetEntriesDto,
  ) {
    return {
      success: true,
      data: await this.decks.setEntries(user.id, user.role, id, dto.entries),
    };
  }
}
