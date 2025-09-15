"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
  } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ReturnPolicyDialog() {
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