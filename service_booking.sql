create database service_booking;

create table member(
	id int not null,
	name varchar(60) not null,
	password varchar(20) not null,
    primary key(id)
);

create table service(
	id int not null,
    owner_id int not null,
    itemName varchar(50) not null,
    description varchar(255) not null,
    availability boolean not null,
    likeCount int not null,
    isDelete boolean,
    primary key(id),
    foreign key(owner_id) references member(id)
);

create table book_record(
	id int not null,
    service_id int not null,
    booker_id int not null,
    status varchar(20),
    foreign key(service_id) references service(id),
    foreign key(booker_id) references member(id)
);

create table picture(
    item int not null,
    path varchar(255) not null,
	primary key(path),
    foreign key(item) references service(id)
);

create table comment(
	id varchar(30) not null,
    item int not null,
    content varchar(255) not null,
	authorId int not null,
    date datetime not null,
    primary key(id),
    foreign key(item) references service(id)
);


-- INSERT INTO member (id, name, password) VALUES (111, "halo", "halo");
-- INSERT INTO member (id, name, password) VALUES (112, "happy", "happy");
-- INSERT INTO member (id, name, password) VALUES (113, "big", "big");

create table token_whitelist(
	jti varchar(255) not null,
    primary key(jti)
);

