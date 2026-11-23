from django.db import models


class Ticket(models.Model):
    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_IN_PROGRESS, "In progress"),
        (STATUS_CLOSED, "Closed"),
    ]
    PRIORITIES = ("low", "medium", "high")

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    customer_email = models.EmailField()
    priority = models.CharField(max_length=10, default="medium")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def to_dict(self, include_replies=False):
        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "customer_email": self.customer_email,
            "priority": self.priority,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }
        if include_replies:
            data["replies"] = [r.to_dict() for r in self.replies.order_by("-created_at")]
        return data


class Reply(models.Model):
    ticket = models.ForeignKey(Ticket, related_name="replies", on_delete=models.CASCADE)
    author = models.CharField(max_length=200)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "author": self.author,
            "message": self.message,
            "created_at": self.created_at.isoformat(),
        }
