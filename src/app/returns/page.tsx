
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { getReturnRequests } from '@/lib/api';

const statusStyles: { [key: string]: string } = {
  Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  Approved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

function ReturnPolicyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">View Policy</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Return Policy</DialogTitle>
          <DialogDescription>
            Our policy for handling customer returns.
          </DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p>
            We accept returns within 30 days of delivery. To be eligible for a return, your item must be in the same condition that you received it, unworn or unused, with tags, and in its original packaging. You’ll also need the receipt or proof of purchase.
          </p>
          <h4>Damages and issues</h4>
          <p>
            Please inspect your order upon reception and contact us immediately if the item is defective, damaged or if you receive the wrong item, so that we can evaluate the issue and make it right.
          </p>
          <h4>Exceptions / non-returnable items</h4>
          <p>
            Certain types of items cannot be returned, like perishable goods (such as food, flowers, or plants), custom products (such as special orders or personalized items), and personal care goods (such as beauty products). Please get in touch if you have questions or concerns about your specific item.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => (document.querySelector('[data-radix-dialog-close]') as HTMLElement)?.click()}>
            Understood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function ReturnsPage() {
  const returnRequests = getReturnRequests();
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Returns</h1>
          <p className="text-muted-foreground">Process and manage customer return requests.</p>
        </div>
        <ReturnPolicyDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Return Requests</CardTitle>
          <CardDescription>A list of all return requests from customers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.id}</TableCell>
                  <TableCell>{request.customerName}</TableCell>
                  <TableCell>{request.productName}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{request.reason}</TableCell>
                  <TableCell>{request.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[request.status]}>{request.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
