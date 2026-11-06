
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activities": {
                  Row: {
                    "actor_id": string,"album_id": string | null,"created_at": string,"id": string,"list_id": string | null,"log_id": string | null,"rating": number | null,"rating_id": string | null,"review_id": string | null,"subject_user_id": string | null,"type": Database["public"]['Enums']["activity_type"],"visibility": Database["public"]['Enums']["visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"album_id"?: string | null,"created_at"?: string,"id"?: string,"list_id"?: string | null,"log_id"?: string | null,"rating"?: number | null,"rating_id"?: string | null,"review_id"?: string | null,"subject_user_id"?: string | null,"type": Database["public"]['Enums']["activity_type"],"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Update: {
                    "actor_id"?: string,"album_id"?: string | null,"created_at"?: string,"id"?: string,"list_id"?: string | null,"log_id"?: string | null,"rating"?: number | null,"rating_id"?: string | null,"review_id"?: string | null,"subject_user_id"?: string | null,"type"?: Database["public"]['Enums']["activity_type"],"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "user_lists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_log_id_fkey"
      columns: ["log_id"]
isOneToOne: false
      referencedRelation: "listening_logs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_rating_id_fkey"
      columns: ["rating_id"]
isOneToOne: false
      referencedRelation: "album_ratings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "reviews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_subject_user_id_fkey"
      columns: ["subject_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"album_artists": {
                  Row: {
                    "album_id": string,"artist_id": string,"credited_name": string | null,"join_phrase": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": string,"artist_id": string,"credited_name"?: string | null,"join_phrase"?: string,"position": number
                  }
                  Update: {
                    "album_id"?: string,"artist_id"?: string,"credited_name"?: string | null,"join_phrase"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "album_artists_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "album_artists_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    }
                  ]
                },"album_genres": {
                  Row: {
                    "album_id": string,"genre_id": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": string,"genre_id": string,"weight"?: number
                  }
                  Update: {
                    "album_id"?: string,"genre_id"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "album_genres_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "album_genres_genre_id_fkey"
      columns: ["genre_id"]
isOneToOne: false
      referencedRelation: "genres"
      referencedColumns: ["id"]
    }
                  ]
                },"album_ratings": {
                  Row: {
                    "album_id": string,"created_at": string,"id": string,"rating": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": string,"created_at"?: string,"id"?: string,"rating": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "album_id"?: string,"created_at"?: string,"id"?: string,"rating"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "album_ratings_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "album_ratings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"album_stats": {
                  Row: {
                    "album_id": string,"average_rating": number | null,"favorites_count": number,"last_activity_at": string | null,"logs_count": number,"rating_histogram": (number)[],"ratings_count": number,"ratings_sum": number,"reviews_count": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": string,"average_rating"?: never,"favorites_count"?: number,"last_activity_at"?: string | null,"logs_count"?: number,"rating_histogram"?: (number)[],"ratings_count"?: number,"ratings_sum"?: number,"reviews_count"?: number,"updated_at"?: string
                  }
                  Update: {
                    "album_id"?: string,"average_rating"?: never,"favorites_count"?: number,"last_activity_at"?: string | null,"logs_count"?: number,"rating_histogram"?: (number)[],"ratings_count"?: number,"ratings_sum"?: number,"reviews_count"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "album_stats_album_id_fkey"
      columns: ["album_id"]
isOneToOne: true
      referencedRelation: "albums"
      referencedColumns: ["id"]
    }
                  ]
                },"albums": {
                  Row: {
                    "album_type": Database["public"]['Enums']["album_type"],"artist_credit": string,"country": string | null,"cover_status": string,"cover_url": string | null,"created_at": string,"duration_ms": number | null,"id": string,"label": string | null,"release_date": string | null,"release_year": number | null,"secondary_types": (string)[],"slug": string,"synced_at": string | null,"title": string,"track_count": number | null,"tracks_synced_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "album_type"?: Database["public"]['Enums']["album_type"],"artist_credit": string,"country"?: string | null,"cover_status"?: string,"cover_url"?: string | null,"created_at"?: string,"duration_ms"?: number | null,"id"?: string,"label"?: string | null,"release_date"?: string | null,"release_year"?: number | null,"secondary_types"?: (string)[],"slug": string,"synced_at"?: string | null,"title": string,"track_count"?: number | null,"tracks_synced_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "album_type"?: Database["public"]['Enums']["album_type"],"artist_credit"?: string,"country"?: string | null,"cover_status"?: string,"cover_url"?: string | null,"created_at"?: string,"duration_ms"?: number | null,"id"?: string,"label"?: string | null,"release_date"?: string | null,"release_year"?: number | null,"secondary_types"?: (string)[],"slug"?: string,"synced_at"?: string | null,"title"?: string,"track_count"?: number | null,"tracks_synced_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"artists": {
                  Row: {
                    "artist_type": string | null,"begin_date": string | null,"country": string | null,"created_at": string,"disambiguation": string | null,"end_date": string | null,"id": string,"image_url": string | null,"name": string,"slug": string,"sort_name": string | null,"synced_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_type"?: string | null,"begin_date"?: string | null,"country"?: string | null,"created_at"?: string,"disambiguation"?: string | null,"end_date"?: string | null,"id"?: string,"image_url"?: string | null,"name": string,"slug": string,"sort_name"?: string | null,"synced_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "artist_type"?: string | null,"begin_date"?: string | null,"country"?: string | null,"created_at"?: string,"disambiguation"?: string | null,"end_date"?: string | null,"id"?: string,"image_url"?: string | null,"name"?: string,"slug"?: string,"sort_name"?: string | null,"synced_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"catalog_sources": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": string,"external_id": string,"fetched_at": string,"id": string,"provider": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": string,"external_id": string,"fetched_at"?: string,"id"?: string,"provider": string,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: string,"external_id"?: string,"fetched_at"?: string,"id"?: string,"provider"?: string,"url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"comment_likes": {
                  Row: {
                    "comment_id": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment_id": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "comment_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comment_likes_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "review_comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comment_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"favorite_albums": {
                  Row: {
                    "album_id": string,"created_at": string,"position": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": string,"created_at"?: string,"position"?: number | null,"user_id": string
                  }
                  Update: {
                    "album_id"?: string,"created_at"?: string,"position"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorite_albums_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorite_albums_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"genres": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_featured": boolean,"name": string,"parent_id": string | null,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_featured"?: boolean,"name": string,"parent_id"?: string | null,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_featured"?: boolean,"name"?: string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "genres_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "genres"
      referencedColumns: ["id"]
    }
                  ]
                },"list_items": {
                  Row: {
                    "album_id": string,"created_at": string,"id": string,"list_id": string,"note": string | null,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": string,"created_at"?: string,"id"?: string,"list_id": string,"note"?: string | null,"position": number
                  }
                  Update: {
                    "album_id"?: string,"created_at"?: string,"id"?: string,"list_id"?: string,"note"?: string | null,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "list_items_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "list_items_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "user_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"list_likes": {
                  Row: {
                    "created_at": string,"list_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"list_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"list_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "list_likes_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "user_lists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "list_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"listening_logs": {
                  Row: {
                    "album_id": string,"created_at": string,"id": string,"is_favorite": boolean,"is_relisten": boolean,"listened_on": string,"note": string | null,"rating": number | null,"updated_at": string,"user_id": string,"visibility": Database["public"]['Enums']["visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": string,"created_at"?: string,"id"?: string,"is_favorite"?: boolean,"is_relisten"?: boolean,"listened_on"?: string,"note"?: string | null,"rating"?: number | null,"updated_at"?: string,"user_id": string,"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Update: {
                    "album_id"?: string,"created_at"?: string,"id"?: string,"is_favorite"?: boolean,"is_relisten"?: boolean,"listened_on"?: string,"note"?: string | null,"rating"?: number | null,"updated_at"?: string,"user_id"?: string,"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "listening_logs_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listening_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_actions": {
                  Row: {
                    "action": Database["public"]['Enums']["moderation_action_type"],"created_at": string,"id": string,"metadata": NonNullable<Json>,"moderator_id": string,"reason": string,"report_id": string | null,"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["moderation_action_type"],"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"moderator_id": string,"reason": string,"report_id"?: string | null,"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["moderation_action_type"],"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"moderator_id"?: string,"reason"?: string,"report_id"?: string | null,"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_actions_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_actions_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string,"comment_id": string | null,"created_at": string,"id": string,"list_id": string | null,"read_at": string | null,"recipient_id": string,"review_id": string | null,"type": Database["public"]['Enums']["notification_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"comment_id"?: string | null,"created_at"?: string,"id"?: string,"list_id"?: string | null,"read_at"?: string | null,"recipient_id": string,"review_id"?: string | null,"type": Database["public"]['Enums']["notification_type"]
                  }
                  Update: {
                    "actor_id"?: string,"comment_id"?: string | null,"created_at"?: string,"id"?: string,"list_id"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"review_id"?: string | null,"type"?: Database["public"]['Enums']["notification_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "review_comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "user_lists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "reviews"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string | null,"created_at": string,"display_name": string | null,"followers_count": number,"following_count": number,"id": string,"location": string | null,"onboarded_at": string | null,"role": Database["public"]['Enums']["user_role"],"suspended_at": string | null,"updated_at": string,"username": string | null,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name"?: string | null,"followers_count"?: number,"following_count"?: number,"id": string,"location"?: string | null,"onboarded_at"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"suspended_at"?: string | null,"updated_at"?: string,"username"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name"?: string | null,"followers_count"?: number,"following_count"?: number,"id"?: string,"location"?: string | null,"onboarded_at"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"suspended_at"?: string | null,"updated_at"?: string,"username"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"provider_cache": {
                  Row: {
                    "cache_key": string,"created_at": string,"expires_at": string,"payload": NonNullable<Json>,"provider": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_key": string,"created_at"?: string,"expires_at": string,"payload": NonNullable<Json>,"provider": string
                  }
                  Update: {
                    "cache_key"?: string,"created_at"?: string,"expires_at"?: string,"payload"?: NonNullable<Json>,"provider"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "bucket_key": string,"hits": number,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_key": string,"hits"?: number,"window_start"?: string
                  }
                  Update: {
                    "bucket_key"?: string,"hits"?: number,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: Database["public"]['Enums']["report_reason"],"reporter_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"review_comments": {
                  Row: {
                    "body": string,"created_at": string,"edited_at": string | null,"hidden_at": string | null,"id": string,"likes_count": number,"parent_id": string | null,"review_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"edited_at"?: string | null,"hidden_at"?: string | null,"id"?: string,"likes_count"?: number,"parent_id"?: string | null,"review_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"edited_at"?: string | null,"hidden_at"?: string | null,"id"?: string,"likes_count"?: number,"parent_id"?: string | null,"review_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "review_comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_comments_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "reviews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"review_likes": {
                  Row: {
                    "created_at": string,"review_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"review_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"review_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_likes_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "reviews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "album_id": string,"body": string,"comments_count": number,"contains_spoilers": boolean,"created_at": string,"edited_at": string | null,"hidden_at": string | null,"id": string,"likes_count": number,"rating": number | null,"title": string | null,"updated_at": string,"user_id": string,"visibility": Database["public"]['Enums']["visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": string,"body": string,"comments_count"?: number,"contains_spoilers"?: boolean,"created_at"?: string,"edited_at"?: string | null,"hidden_at"?: string | null,"id"?: string,"likes_count"?: number,"rating"?: number | null,"title"?: string | null,"updated_at"?: string,"user_id": string,"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Update: {
                    "album_id"?: string,"body"?: string,"comments_count"?: number,"contains_spoilers"?: boolean,"created_at"?: string,"edited_at"?: string | null,"hidden_at"?: string | null,"id"?: string,"likes_count"?: number,"rating"?: number | null,"title"?: string | null,"updated_at"?: string,"user_id"?: string,"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subscription_plans": {
                  Row: {
                    "billing_interval": string,"code": string,"created_at": string,"currency": string,"description": string | null,"features": NonNullable<Json>,"id": string,"is_active": boolean,"name": string,"price_cents": number,"razorpay_plan_id": string | null,"stripe_price_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_interval": string,"code": string,"created_at"?: string,"currency": string,"description"?: string | null,"features"?: NonNullable<Json>,"id"?: string,"is_active"?: boolean,"name": string,"price_cents": number,"razorpay_plan_id"?: string | null,"stripe_price_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "billing_interval"?: string,"code"?: string,"created_at"?: string,"currency"?: string,"description"?: string | null,"features"?: NonNullable<Json>,"id"?: string,"is_active"?: boolean,"name"?: string,"price_cents"?: number,"razorpay_plan_id"?: string | null,"stripe_price_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tracks": {
                  Row: {
                    "album_id": string,"created_at": string,"disc_number": number,"duration_ms": number | null,"id": string,"number": string | null,"position": number,"recording_mbid": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": string,"created_at"?: string,"disc_number"?: number,"duration_ms"?: number | null,"id"?: string,"number"?: string | null,"position": number,"recording_mbid"?: string | null,"title": string
                  }
                  Update: {
                    "album_id"?: string,"created_at"?: string,"disc_number"?: number,"duration_ms"?: number | null,"id"?: string,"number"?: string | null,"position"?: number,"recording_mbid"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tracks_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "albums"
      referencedColumns: ["id"]
    }
                  ]
                },"user_blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_favorite_artists": {
                  Row: {
                    "artist_id": string,"created_at": string,"position": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"created_at"?: string,"position"?: number,"user_id": string
                  }
                  Update: {
                    "artist_id"?: string,"created_at"?: string,"position"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_favorite_artists_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_favorite_artists_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_favorite_genres": {
                  Row: {
                    "created_at": string,"genre_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"genre_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"genre_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_favorite_genres_genre_id_fkey"
      columns: ["genre_id"]
isOneToOne: false
      referencedRelation: "genres"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_favorite_genres_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_follows": {
                  Row: {
                    "created_at": string,"follower_id": string,"following_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"follower_id": string,"following_id": string
                  }
                  Update: {
                    "created_at"?: string,"follower_id"?: string,"following_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_follows_following_id_fkey"
      columns: ["following_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_lists": {
                  Row: {
                    "cover_path": string | null,"created_at": string,"description": string | null,"hidden_at": string | null,"id": string,"is_ranked": boolean,"items_count": number,"likes_count": number,"title": string,"updated_at": string,"user_id": string,"visibility": Database["public"]['Enums']["visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"hidden_at"?: string | null,"id"?: string,"is_ranked"?: boolean,"items_count"?: number,"likes_count"?: number,"title": string,"updated_at"?: string,"user_id": string,"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Update: {
                    "cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"hidden_at"?: string | null,"id"?: string,"is_ranked"?: boolean,"items_count"?: number,"likes_count"?: number,"title"?: string,"updated_at"?: string,"user_id"?: string,"visibility"?: Database["public"]['Enums']["visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_lists_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_preferences": {
                  Row: {
                    "created_at": string,"default_list_visibility": Database["public"]['Enums']["visibility"],"default_log_visibility": Database["public"]['Enums']["visibility"],"default_review_visibility": Database["public"]['Enums']["visibility"],"email_notifications": boolean,"notify_comments": boolean,"notify_follows": boolean,"notify_likes": boolean,"notify_mentions": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_list_visibility"?: Database["public"]['Enums']["visibility"],"default_log_visibility"?: Database["public"]['Enums']["visibility"],"default_review_visibility"?: Database["public"]['Enums']["visibility"],"email_notifications"?: boolean,"notify_comments"?: boolean,"notify_follows"?: boolean,"notify_likes"?: boolean,"notify_mentions"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"default_list_visibility"?: Database["public"]['Enums']["visibility"],"default_log_visibility"?: Database["public"]['Enums']["visibility"],"default_review_visibility"?: Database["public"]['Enums']["visibility"],"email_notifications"?: boolean,"notify_comments"?: boolean,"notify_follows"?: boolean,"notify_likes"?: boolean,"notify_mentions"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"id": string,"plan_id": string,"provider": string,"provider_subscription_id": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_id": string,"provider": string,"provider_subscription_id"?: string | null,"status": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_id"?: string,"provider"?: string,"provider_subscription_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "subscription_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_favorite_album":
{ Args: { "p_album_id": string }; Returns: number
                           },
"append_list_item":
{ Args: { "p_album_id": string,"p_list_id": string,"p_note"?: string }; Returns: string
                           },
"browse_albums":
{ Args: { "p_country"?: string,"p_decade"?: number,"p_genre"?: string,"p_limit"?: number,"p_min_ratings"?: number,"p_offset"?: number,"p_sort"?: string,"p_year"?: number }; Returns: {
              "album_type": Database["public"]['Enums']["album_type"],"artist_credit": string,"average_rating": number,"cover_url": string,"id": string,"ratings_count": number,"release_year": number,"score": number,"slug": string,"title": string
            }[]
                           },
"can_view":
{ Args: { "owner_id": string,"vis": Database["public"]['Enums']["visibility"] }; Returns: boolean
                           },
"consume_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: {
              "allowed": boolean,"remaining": number,"reset_at": string
            }[]
                           },
"explore_facets":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"ingest_album":
{ Args: { "p": Json }; Returns: string
                           },
"ingest_artist":
{ Args: { "p": Json }; Returns: string
                           },
"is_moderator":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"moderate_content":
{ Args: { "p_action": string,"p_reason": string,"p_report_id"?: string,"p_target_id": string,"p_target_type": Database["public"]['Enums']["report_target"] }; Returns: string
                           },
"reorder_list_items":
{ Args: { "p_item_ids": (string)[],"p_list_id": string }; Returns: undefined
                           },
"search_albums":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "album_type": Database["public"]['Enums']["album_type"],"artist_credit": string,"cover_url": string,"id": string,"release_year": number,"score": number,"slug": string,"title": string
            }[]
                           },
"search_artists":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "artist_type": string,"country": string,"disambiguation": string,"id": string,"name": string,"slug": string
            }[]
                           },
"set_favorite_showcase":
{ Args: { "p_album_ids": (string)[] }; Returns: undefined
                           },
"viewer_blocked_with":
{ Args: { "other_user": string }; Returns: boolean
                           },
"viewer_follows":
{ Args: { "target_user": string }; Returns: boolean
                           },
"viewer_owns_list":
{ Args: { "target_list": string }; Returns: boolean
                           }
          }
          Enums: {
            "activity_type": "rated"|"logged"|"reviewed"|"created_list"|"liked_review"|"liked_list"|"followed","album_type": "album"|"ep"|"single"|"compilation"|"live"|"soundtrack"|"remix"|"mixtape"|"broadcast"|"other","moderation_action_type": "dismiss"|"warn"|"hide_content"|"delete_content"|"suspend_user"|"restore_content"|"unsuspend_user","notification_type": "followed"|"liked_review"|"commented_review"|"replied_comment"|"liked_comment"|"liked_list"|"mentioned","report_reason": "spam"|"harassment"|"hate"|"sexual_content"|"violence"|"impersonation"|"misinformation"|"copyright"|"other","report_status": "open"|"reviewing"|"resolved"|"dismissed","report_target": "review"|"comment"|"list"|"profile","user_role": "user"|"moderator"|"admin","visibility": "public"|"followers"|"private"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "activity_type": ["rated", "logged", "reviewed", "created_list", "liked_review", "liked_list", "followed"],"album_type": ["album", "ep", "single", "compilation", "live", "soundtrack", "remix", "mixtape", "broadcast", "other"],"moderation_action_type": ["dismiss", "warn", "hide_content", "delete_content", "suspend_user", "restore_content", "unsuspend_user"],"notification_type": ["followed", "liked_review", "commented_review", "replied_comment", "liked_comment", "liked_list", "mentioned"],"report_reason": ["spam", "harassment", "hate", "sexual_content", "violence", "impersonation", "misinformation", "copyright", "other"],"report_status": ["open", "reviewing", "resolved", "dismissed"],"report_target": ["review", "comment", "list", "profile"],"user_role": ["user", "moderator", "admin"],"visibility": ["public", "followers", "private"]
          }
        }
} as const
