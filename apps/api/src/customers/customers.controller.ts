import { Controller, Get, Param, Headers } from '@nestjs/common';
import { CustomersService } from './customers.service';

@Controller('v1/merchant/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async getCustomers(@Headers('x-store-id') storeId?: string) {
    const list = await this.customersService.getCustomers(storeId);
    return {
      success: true,
      data: list,
    };
  }

  @Get(':id')
  async getCustomerById(@Param('id') id: string) {
    const customer = await this.customersService.getCustomerById(id);
    return {
      success: true,
      data: customer,
    };
  }
}
