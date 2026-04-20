import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface RefreshUser {
  sessionId: string;
  userId: string;
  email: string;
  username: string;
}

@Injectable()
export class JwtRefreshGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ cookies?: Record<string, string>; user?: RefreshUser }>();
    const rawToken: string | undefined = req.cookies?.['refreshToken'];
    if (!rawToken) throw new UnauthorizedException();

    const hashed = createHash('sha256').update(rawToken).digest('hex');
    const session = await this.prisma.session.findUnique({
      where: { refreshToken: hashed },
      include: { user: { select: { email: true, username: true, deletedAt: true } } },
    });

    if (!session || !session.user || session.user.deletedAt) throw new UnauthorizedException();

    req.user = {
      sessionId: session.id,
      userId: session.userId,
      email: session.user.email,
      username: session.user.username,
    };

    return true;
  }
}
