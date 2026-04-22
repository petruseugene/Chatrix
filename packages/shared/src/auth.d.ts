import { type z } from 'zod';
export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}
export declare const registerSchema: z.ZodObject<
  {
    email: z.ZodString;
    password: z.ZodString;
    username: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    email: string;
    password: string;
    username: string;
  },
  {
    email: string;
    password: string;
    username: string;
  }
>;
export declare const loginSchema: z.ZodObject<
  {
    email: z.ZodString;
    password: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    email: string;
    password: string;
  },
  {
    email: string;
    password: string;
  }
>;
export declare const changePasswordSchema: z.ZodObject<
  {
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    currentPassword: string;
    newPassword: string;
  },
  {
    currentPassword: string;
    newPassword: string;
  }
>;
export declare const requestResetSchema: z.ZodObject<
  {
    email: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    email: string;
  },
  {
    email: string;
  }
>;
export declare const resetPasswordSchema: z.ZodObject<
  {
    token: z.ZodString;
    newPassword: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    newPassword: string;
    token: string;
  },
  {
    newPassword: string;
    token: string;
  }
>;
//# sourceMappingURL=auth.d.ts.map
