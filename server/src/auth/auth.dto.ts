import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CredentialsDto {
  @IsString()
  @MinLength(3, { message: 'El usuario debe tener al menos 3 caracteres' })
  @MaxLength(20, { message: 'El usuario no puede superar 20 caracteres' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'El usuario solo admite letras, números, guion y guion bajo',
  })
  username: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(72)
  password: string;
}
