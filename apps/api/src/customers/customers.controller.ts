import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CurrentMerchant, MerchantGuard, type MerchantContext } from '../auth/guards';

@Controller('v1/merchant/customers')
@UseGuards(MerchantGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async getCustomers(@CurrentMerchant() merchant: MerchantContext) {
    const list = await this.customersService.getCustomers(merchant.storeId);
    return {
      success: true,
      data: list,
    };
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
