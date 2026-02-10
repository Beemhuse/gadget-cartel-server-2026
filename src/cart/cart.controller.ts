import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  getCart(@Req() req) {
    return this.cartService.getCart(req.user.sub);
  }

  @Post('add')
  @ApiOperation({ summary: 'Add item to cart' })
  addItem(
    @Req() req,
    @Body() body: { product_id: string; quantity: number; metadata?: any },
  ) {
    return this.cartService.addItem(
      req.user.sub,
      body.product_id,
      body.quantity,
      body.metadata,
    );
  }

  @Patch('items/:id/update')
  @ApiOperation({ summary: 'Update cart item' })
  updateItem(
    @Req() req,
    @Param('id') id: string,
    @Body() body: { quantity?: number; metadata?: any },
  ) {
    return this.cartService.updateItem(req.user.sub, id, body);
  }

  @Delete('items/:id/remove')
  @ApiOperation({ summary: 'Remove item from cart' })
  removeItem(@Req() req, @Param('id') id: string) {
    return this.cartService.removeItem(req.user.sub, id);
  }

  @Post('clear')
  @ApiOperation({ summary: 'Clear cart' })
  clearCart(@Req() req) {
    console.log(req.user);
    return this.cartService.clearCart(req.user.sub);
  }
}
