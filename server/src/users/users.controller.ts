import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { UsersService } from './users.service';
import { UserRole, BoardTheme } from './user.schema';
import { JwtAuthGuard, Roles, RolesGuard, CurrentUser } from '../auth/guards';
import { AuthenticatedUser } from '../auth/jwt.strategy';

class UpdateMeDto {
  @IsOptional()
  @IsObject()
  board_theme?: BoardTheme;

  @IsOptional()
  @IsString()
  active_deck_id?: string;
}

class SetRoleDto {
  @IsIn(['admin', 'supervisor', 'comun'])
  role: UserRole;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.users.getMe(user.id) };
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return { success: true, data: await this.users.updateMe(user.id, dto) };
  }

  @Get()
  @Roles('admin')
  async list() {
    return { success: true, data: await this.users.listAll() };
  }

  @Patch(':id/role')
  @Roles('admin')
  async setRole(@Param('id') id: string, @Body() dto: SetRoleDto) {
    return { success: true, data: await this.users.setRole(id, dto.role) };
  }
}
