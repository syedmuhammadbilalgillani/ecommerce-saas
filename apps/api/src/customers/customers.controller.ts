import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { parseLimit } from '../common/pagination';
import { CustomersService } from './customers.service';
import { CurrentMerchant, MerchantGuard, type MerchantContext } from '../auth/guards';

@Controller('v1/merchant/customers')
@UseGuards(MerchantGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async getCustomers(
    @CurrentMerchant() merchant: MerchantContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('q') q?: string
  ) {
    const page = await this.customersService.getCustomers(merchant.storeId, { limit: parseLimit(limit), cursor, q });
    return { success: true, ...page };
  }

  @Get(':id')
  async getCustomerById(@CurrentMerchant() merchant: MerchantContext, @Param('id') id: string) {
    const customer = await this.customersService.getCustomerById(merchant.storeId, id);
    return {
      success: true,
      data: customer,
    };
  }
}
