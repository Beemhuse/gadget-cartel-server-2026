import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Patch,
  UseGuards,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { QueryProductDto } from './dto/query-product.dto';
import {
  CreateBrandDto,
  UpdateBrandDto,
  CreateTagDto,
  UpdateTagDto,
  CreateColorDto,
  UpdateColorDto,
  CreateStorageOptionDto,
  UpdateStorageOptionDto,
} from './dto/product-relations.dto';
// import { AuthGuard } from '@nestjs/passport'; // Uncomment when needed for admin routes

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('list')
  @ApiOperation({ summary: 'List all products with filters and pagination' })
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all product categories' })
  getCategories(@Query() query: any) {
    return this.productsService.findAllCategories(query);
  }

  @Get('brands')
  @ApiOperation({ summary: 'List all product brands' })
  getBrands() {
    return this.productsService.findAllBrands();
  }

  @Get(':slug/detail')
  @ApiOperation({ summary: 'Get product details' })
  findOne(@Param('slug') slug: string) {
    return this.productsService.findOne(slug);
  }

  // Admin routes (should be protected)
  @Post('create')
  @ApiOperation({ summary: 'Create a new product' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Put(':slug/update')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @Param('slug') slugOrId: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(slugOrId, updateProductDto);
  }

  @Patch(':slug/update')
  @ApiOperation({ summary: 'Patch a product' })
  patch(
    @Param('slug') slugOrId: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(slugOrId, updateProductDto);
  }

  @Delete(':slug/delete')
  @ApiOperation({ summary: 'Delete a product' })
  remove(@Param('slug') slugOrId: string) {
    return this.productsService.remove(slugOrId);
  }

  // Category CRUD
  @Post('categories')
  @UseInterceptors(FileInterceptor('icon'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a product category' })
  createCategory(
    @Body() body: CreateCategoryDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.productsService.createCategory(body, icon);
  }

  @Put('categories/:slug')
  @UseInterceptors(FileInterceptor('icon'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a product category' })
  updateCategory(
    @Param('slug') slugOrId: string,
    @Body() body: any,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.productsService.updateCategory(slugOrId, body, icon);
  }

  @Patch('categories/:slug')
  @UseInterceptors(FileInterceptor('icon'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Patch a product category' })
  patchCategory(
    @Param('slug') slugOrId: string,
    @Body() body: any,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.productsService.updateCategory(slugOrId, body, icon);
  }

  @Delete('categories/:slug')
  @ApiOperation({ summary: 'Delete a product category' })
  deleteCategory(@Param('slug') slugOrId: string) {
    return this.productsService.deleteCategory(slugOrId);
  }

  // Brands CRUD
  @Post('brands')
  @ApiOperation({ summary: 'Create a product brand' })
  createBrand(@Body() body: CreateBrandDto) {
    return this.productsService.createBrand(body);
  }

  @Put('brands/:id')
  @ApiOperation({ summary: 'Update a product brand' })
  updateBrand(@Param('id') id: string, @Body() body: UpdateBrandDto) {
    return this.productsService.updateBrand(id, body);
  }

  @Delete('brands/:id')
  @ApiOperation({ summary: 'Delete a product brand' })
  deleteBrand(@Param('id') id: string) {
    return this.productsService.deleteBrand(id);
  }

  // Tags CRUD
  @Get('tags')
  @ApiOperation({ summary: 'List all product tags' })
  getTags() {
    return this.productsService.findAllTags();
  }

  @Post('tags')
  @ApiOperation({ summary: 'Create a product tag' })
  createTag(@Body() body: CreateTagDto) {
    return this.productsService.createTag(body);
  }

  @Put('tags/:id')
  @ApiOperation({ summary: 'Update a product tag' })
  updateTag(@Param('id') id: string, @Body() body: UpdateTagDto) {
    return this.productsService.updateTag(id, body);
  }

  @Delete('tags/:id')
  @ApiOperation({ summary: 'Delete a product tag' })
  deleteTag(@Param('id') id: string) {
    return this.productsService.deleteTag(id);
  }

  // Colors CRUD
  @Get('colors')
  @ApiOperation({ summary: 'List all product colors' })
  getColors() {
    return this.productsService.findAllColors();
  }

  @Post('colors')
  @ApiOperation({ summary: 'Create a product color' })
  createColor(@Body() body: CreateColorDto) {
    return this.productsService.createColor(body);
  }

  @Put('colors/:id')
  @ApiOperation({ summary: 'Update a product color' })
  updateColor(@Param('id') id: string, @Body() body: UpdateColorDto) {
    return this.productsService.updateColor(id, body);
  }

  @Delete('colors/:id')
  @ApiOperation({ summary: 'Delete a product color' })
  deleteColor(@Param('id') id: string) {
    return this.productsService.deleteColor(id);
  }

  // Storage Options CRUD
  @Get('storage-options')
  @ApiOperation({ summary: 'List all product storage options' })
  getStorageOptions() {
    return this.productsService.findAllStorageOptions();
  }

  @Post('storage-options')
  @ApiOperation({ summary: 'Create a product storage option' })
  createStorageOption(@Body() body: CreateStorageOptionDto) {
    return this.productsService.createStorageOption(body);
  }

  @Put('storage-options/:id')
  @ApiOperation({ summary: 'Update a product storage option' })
  updateStorageOption(
    @Param('id') id: string,
    @Body() body: UpdateStorageOptionDto,
  ) {
    return this.productsService.updateStorageOption(id, body);
  }

  @Delete('storage-options/:id')
  @ApiOperation({ summary: 'Delete a product storage option' })
  deleteStorageOption(@Param('id') id: string) {
    return this.productsService.deleteStorageOption(id);
  }

  // Product image management (Cloudinary)
  @Post(':slug/images')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a single product image' })
  uploadProductImage(
    @Param('slug') slugOrId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return this.productsService.uploadProductImage(slugOrId, file, body);
  }

  @Post(':slug/images/bulk')
  @UseInterceptors(FilesInterceptor('images'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple product images' })
  uploadProductImages(
    @Param('slug') slugOrId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.uploadProductImages(slugOrId, files);
  }

  @Patch(':slug/images/:imageId')
  @ApiOperation({ summary: 'Update product image metadata' })
  updateProductImage(
    @Param('slug') slugOrId: string,
    @Param('imageId') imageId: string,
    @Body() body: any,
  ) {
    return this.productsService.updateProductImage(slugOrId, imageId, body);
  }

  @Delete(':slug/images/:imageId')
  @ApiOperation({ summary: 'Delete a product image' })
  deleteProductImage(
    @Param('slug') slugOrId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.deleteProductImage(slugOrId, imageId);
  }
}
