import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { products } from '@/lib/data';

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Product Catalog</h1>
        <p className="text-muted-foreground">Browse and manage your product listings.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="font-headline">{product.name}</CardTitle>
              <CardDescription>{product.category}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="aspect-video overflow-hidden rounded-md mb-4">
                 <Image
                  src={product.imageUrl}
                  alt={product.name}
                  width={600}
                  height={400}
                  className="object-cover transition-transform hover:scale-105"
                  data-ai-hint={product.imageHint}
                />
              </div>
              <p className="text-sm text-muted-foreground mb-4">{product.description}</p>
              <div className="flex justify-between items-center">
                <p className="text-lg font-semibold">${product.price.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Stock: {product.stock}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">View Details</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
