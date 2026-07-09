import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { GamesService } from './games.service';
import { JwtAuthGuard, CurrentUser } from '../auth/guards';
import { AuthenticatedUser } from '../auth/jwt.strategy';

class JoinDto {
  @IsString() @Length(6, 6) room_code: string;
}

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser) {
    const game = await this.games.createRoom(user.id);
    return {
      success: true,
      data: { game_id: game._id, room_code: game.room_code },
    };
  }

  @Post('join')
  async join(@CurrentUser() user: AuthenticatedUser, @Body() dto: JoinDto) {
    const result = await this.games.joinRoom(user.id, dto.room_code);
    return {
      success: true,
      data: {
        game_id: result.game._id,
        status: result.game.status,
        seat: result.seat,
        host_name: result.hostName,
        guest_name: result.guestName,
        host_deck: result.hostDeck,
        guest_deck: result.guestDeck,
        state: result.game.state,
        version: result.game.version,
      },
    };
  }

  @Get(':id')
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const game = await this.games.getForUser(id, user.id);
    return {
      success: true,
      data: {
        game_id: game._id,
        room_code: game.room_code,
        status: game.status,
        seat: this.games.seatOf(game, user.id),
        state: game.state,
        version: game.version,
        winner_seat: game.winner_seat,
      },
    };
  }
}
