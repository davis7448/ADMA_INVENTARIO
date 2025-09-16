
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
import { getReturnRequests } from '@/lib/api';
import { ReturnPolicyDialog } from '@/components/return-policy-dialog';

const statusStyles: { [key: string]: string } = {
  Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  Approved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

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
              {returnRequests.length > 0 ? (
                returnRequests.map((request) => (
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No return requests found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
